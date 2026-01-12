document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userIcon = document.getElementById("user-icon");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const closeModal = document.querySelector(".close");
  const logoutBtn = document.getElementById("logout-btn");
  const authStatus = document.getElementById("auth-status");
  const usernameDisplay = document.getElementById("username-display");
  const authRequiredMessage = document.getElementById("auth-required-message");
  
  let authToken = localStorage.getItem("authToken") || null;

  // Authentication functions
  async function checkAuth() {
    if (!authToken) {
      updateUIForLoggedOut();
      return false;
    }
    
    try {
      const response = await fetch("/auth/verify", {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      
      const result = await response.json();
      
      if (result.authenticated) {
        updateUIForLoggedIn(result.username);
        return true;
      } else {
        authToken = null;
        localStorage.removeItem("authToken");
        updateUIForLoggedOut();
        return false;
      }
    } catch (error) {
      console.error("Error verifying auth:", error);
      authToken = null;
      localStorage.removeItem("authToken");
      updateUIForLoggedOut();
      return false;
    }
  }
  
  function updateUIForLoggedIn(username) {
    usernameDisplay.textContent = username;
    authStatus.classList.remove("hidden");
    signupForm.classList.remove("hidden");
    authRequiredMessage.classList.add("hidden");
    userIcon.style.backgroundColor = "#4CAF50";
    
    // Show delete buttons
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.style.display = "inline-block";
    });
  }
  
  function updateUIForLoggedOut() {
    authStatus.classList.add("hidden");
    signupForm.classList.add("hidden");
    authRequiredMessage.classList.remove("hidden");
    userIcon.style.backgroundColor = "";
    
    // Hide delete buttons
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.style.display = "none";
    });
  }
  
  // Modal functionality
  userIcon.addEventListener("click", () => {
    if (authToken) {
      // Already logged in, show status or do nothing
      return;
    }
    loginModal.classList.remove("hidden");
  });
  
  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
    loginMessage.classList.add("hidden");
  });
  
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginForm.reset();
      loginMessage.classList.add("hidden");
    }
  });
  
  // Handle login
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          method: "POST"
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        authToken = result.token;
        localStorage.setItem("authToken", authToken);
        loginMessage.textContent = result.message;
        loginMessage.className = "success";
        loginMessage.classList.remove("hidden");
        
        setTimeout(() => {
          loginModal.classList.add("hidden");
          loginForm.reset();
          loginMessage.classList.add("hidden");
          checkAuth();
          fetchActivities(); // Refresh to show delete buttons
        }, 1000);
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Login failed. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });
  
  // Handle logout
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
    
    authToken = null;
    localStorage.removeItem("authToken");
    updateUIForLoggedOut();
    fetchActivities(); // Refresh to hide delete buttons
  });

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons (hidden by default for non-authenticated users)
        const deleteButtonStyle = authToken ? 'style="display: inline-block;"' : 'style="display: none;"';
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}" ${deleteButtonStyle}>❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      messageDiv.textContent = "You must be logged in as a teacher to unregister students.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!authToken) {
      messageDiv.textContent = "You must be logged in as a teacher to register students.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuth().then(() => {
    fetchActivities();
  });
});

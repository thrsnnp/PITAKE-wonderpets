
import { supabase } from "./supabaseClient.js";

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginMessage.textContent = "Logging in...";

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        loginMessage.textContent = error.message;
        return;
    }

    loginMessage.style.color = "green";
    loginMessage.textContent = "Login successful!";

    console.log("Logged in user:", data.user);

    // Check the user's role in the database
    const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("first_name, last_name, role, department, is_active")
        .eq("id", data.user.id)
        .single();

    if (profileError) {
        loginMessage.style.color = "red";
        loginMessage.textContent = "Unable to verify account role.";

        await supabase.auth.signOut();
        return;
    }

    // Check whether the account is active
    if (!profile.is_active) {
        loginMessage.style.color = "red";
        loginMessage.textContent =
            "Your account is inactive. Please contact an administrator.";

        await supabase.auth.signOut();
        return;
    }

    console.log("User verified:", profile);

    console.log("Admin verified:", profile);

    window.location.href = "pages/dashboard.html";
});

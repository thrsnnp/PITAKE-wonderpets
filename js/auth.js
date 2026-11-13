
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
        .select("first_name, last_name, role, department")
        .eq("id", data.user.id)
        .single();

    if (profileError) {
        loginMessage.style.color = "red";
        loginMessage.textContent = "Unable to verify account role.";

        await supabase.auth.signOut();
        return;
    }

    if (profile.role !== "Admin") {
        loginMessage.style.color = "red";
        loginMessage.textContent = "Access denied. Admin account required.";

        await supabase.auth.signOut();
        return;
    }

    console.log("Admin verified:", profile);
    loginMessage.textContent = "Admin login successful!";
});

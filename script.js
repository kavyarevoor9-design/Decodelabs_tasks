// Mobile menu
const menuButton = document.getElementById("menuButton");
const navMenu = document.getElementById("navMenu");

menuButton.addEventListener("click", function () {
    if (navMenu.style.display === "block") {
        navMenu.style.display = "none";
    } else {
        navMenu.style.display = "block";
    }
});


// Task completion
const taskContainer = document.querySelector(".task-container");

function addTaskBehavior(checkbox, taskText) {
    checkbox.addEventListener("change", function () {
        if (checkbox.checked) {
            taskText.style.textDecoration = "line-through";
            taskText.style.opacity = "0.5";
        } else {
            taskText.style.textDecoration = "none";
            taskText.style.opacity = "1";
        }
    });
}


// Existing tasks
const existingTasks = taskContainer.querySelectorAll("label");

existingTasks.forEach(function (task) {
    const checkbox = task.querySelector("input");
    
    addTaskBehavior(checkbox, task);
});


// Add Task
const addTaskButton = document.getElementById("addTaskButton");

addTaskButton.addEventListener("click", function () {

    const taskName = prompt("Enter your task:");

    if (taskName !== null && taskName.trim() !== "") {

        const label = document.createElement("label");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";

        const taskText = document.createElement("span");
        taskText.textContent = taskName;

        label.appendChild(checkbox);
        label.appendChild(taskText);

        taskContainer.appendChild(label);

        addTaskBehavior(checkbox, taskText);
    }
});
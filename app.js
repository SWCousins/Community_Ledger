let state = {};
let currentMemberId = null;
const MATCH_RATIO = 0.5;

async function loadState() {
    const res = await fetch("/api/state");
    state = await res.json();
    renderMembers();
    renderTasks();
}

function renderMembers() {
    const select = document.getElementById("memberSelect");
    select.innerHTML = "";

    state.members.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        select.appendChild(opt);
    });

    currentMemberId = Number(select.value);
    updateCredits();

    select.onchange = () => {
        currentMemberId = Number(select.value);
        updateCredits();
    };
}

function updateCredits() {
    const member = state.members.find(m => m.id === currentMemberId);
    document.getElementById("credits").textContent = `Credits: ${member.credits}`;
}

async function createTask() {
    const title = document.getElementById("taskTitle").value;
    await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, creatorId: currentMemberId })
    });
    loadState();
}

async function pledge(taskId) {
    await fetch(`/api/tasks/${taskId}/pledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMemberId, amount: 10 })
    });
    loadState();
}

async function approve(taskId) {
    await fetch(`/api/tasks/${taskId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: currentMemberId })
    });
    loadState();
}

async function complete(taskId) {
    await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMemberId })
    });
    loadState();
}

function renderTasks() {
    const div = document.getElementById("tasks");
    div.innerHTML = "";

    state.tasks.forEach(t => {
        const creator = state.members.find(m => m.id === t.creatorId);
        const payout = Math.floor(t.pledgedCredits * MATCH_RATIO) * 2;

        const el = document.createElement("div");
        el.innerHTML = `
      <hr/>
      <strong>${t.title}</strong><br/>
      Created by: ${creator.name}<br/>
      Pledged: ${t.pledgedCredits}<br/>
      Total payout if completed now: ${payout}<br/>
      ${t.completed ? `✅ Completed by ${state.members.find(m => m.id === t.completedBy).name}` :
                `
        ${t.approved ? "✅ Approved" : `<button onclick="approve(${t.id})">Approve</button>`}
        <button onclick="pledge(${t.id})">Pledge 10</button>
        <button onclick="complete(${t.id})">Complete</button>
        `
            }
    `;
        div.appendChild(el);
    });
}

loadState();

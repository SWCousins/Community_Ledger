// data.js
let members = [
    { id: 1, name: "Alice", credits: 100 },
    { id: 2, name: "Bob", credits: 80 },
];

let incentiveFunds = [
    {
        id: 1,
        name: "Tomato Fund",
        targetOutput: 50,
        pledgedCredits: 0,
        contributions: [],
        completedOutput: 0,
        creditsPerUnit: 10, // newly created credits per unit output
        tasks: []
    }
];

let nextFundId = 2;
let nextTaskId = 1;

module.exports = { members, incentiveFunds, nextFundId, nextTaskId };
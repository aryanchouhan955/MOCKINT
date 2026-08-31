const mongoose = require("mongoose");

const InterviewSchema = new mongoose.Schema({
    userId : {type: mongoose.Schema.Types.ObjectId, ref: "User"},
    resume : String,
    inputs : Object,
    conversation: Object,
    timestamp : {type: Date, default: Date.now()}
})

module.exports = mongoose.model("Interview", InterviewSchema);

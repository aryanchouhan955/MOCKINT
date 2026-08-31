const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());


app.get('/', (req, res) => {
  res.send('AI Interviewer API');
});

// create an interview
app.post("/api/interviews/create", (req, res)=> {
  const {userId, resume, inputs} = req.body;
  if(!resume || !inputs) return res.status(400).json({message: "Resume and inputs are required"});

  
})

// next question
app.post("/api/interviews/:id/next-question", (req, res)=>{

})




app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

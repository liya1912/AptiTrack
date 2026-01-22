/*const express = require("express");
const router = express.Router();

router.get("/dashboard", (req, res) => {
  res.render("student/dashboard");
});

module.exports = router;*/


/*const express = require("express");
const router = express.Router();
const { isAuthenticated, isStudent } = require('../middleware/auth');

// Protect all student routes
router.use(isAuthenticated);
router.use(isStudent);

router.get("/dashboard", (req, res) => {
  res.render("student/dashboard", {
    user: req.session.user
  });
});

module.exports = router;*/
// routes/studentRoutes.js - COMPLETE VERSION
const express = require("express");
const router = express.Router();
const { isAuthenticated, isStudent } = require('../middleware/auth');
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const Result = require('../models/Result');
const Question = require('../models/Question');

// Protect all student routes
router.use(isAuthenticated);
router.use(isStudent);

// Student Dashboard
router.get("/dashboard", (req, res) => {
  res.render("student/dashboard", {
    user: req.session.user
  });
});

// Get all available tests
router.get('/available-tests', async (req, res) => {
  try {
    const currentDate = new Date();
    const studentId = req.session.user._id;

    // Find active tests within date range
    const tests = await Test.find({
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    }).populate('questions');

    // Get already attempted tests (check both Attempt and Result models)
    const completedResults = await Result.find({ 
      student: studentId
    }).select('test');
    
    const completedAttempts = await Attempt.find({
      student: studentId,
      isSubmitted: true
    }).select('test');

    const attemptedTestIds = [
      ...completedResults.map(r => r.test.toString()),
      ...completedAttempts.map(a => a.test.toString())
    ];

    res.render('student/available-tests', { 
      tests,
      attemptedTestIds,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).send('Error loading tests');
  }
});

// Start a test
router.get('/take-test/:testId', async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId)
      .populate('questions');
    const studentId = req.session.user._id;

    if (!test) {
      return res.status(404).send('Test not found');
    }

    // Check if test is active and within date range
    const currentDate = new Date();
    if (!test.isActive || currentDate < test.startDate || currentDate > test.endDate) {
      return res.status(403).send('This test is not currently available');
    }

    // Check if already submitted in Result model
    const existingResult = await Result.findOne({ 
      student: studentId, 
      test: test._id 
    });

    if (existingResult) {
      return res.redirect('/student/test-result/' + existingResult._id);
    }

    // Check if already submitted in Attempt model
    const existingAttempt = await Attempt.findOne({ 
      student: studentId, 
      test: test._id 
    });

    if (existingAttempt && existingAttempt.isSubmitted) {
      return res.status(403).send('You have already attempted this test');
    }

    // Create new attempt if doesn't exist
    if (!existingAttempt) {
      await Attempt.create({
        student: studentId,
        test: test._id,
        totalQuestions: test.questions.length,
        currentAnswers: []
      });
    }

    res.render('student/take-test', { 
      test,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error starting test:', error);
    res.status(500).send('Error starting test');
  }
});

// Submit test
router.post('/submit-test/:testId', async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId)
      .populate('questions');
    const studentId = req.session.user._id;
    const { answers, timeTaken } = req.body;

    if (!test) {
      return res.status(404).send('Test not found');
    }

    // Parse answers from form
    const parsedAnswers = [];
    const answerDetails = [];
    
    for (let i = 0; i < test.questions.length; i++) {
      const selectedAnswer = answers[i];
      const question = test.questions[i];
      
      if (selectedAnswer) {
        parsedAnswers.push({
          question: question._id,
          selectedAnswer: selectedAnswer
        });

        // Check if answer is correct
        const isCorrect = selectedAnswer === question.correctAnswer;
        
        answerDetails.push({
          question: question._id,
          selectedAnswer: selectedAnswer,
          isCorrect: isCorrect,
          marksObtained: isCorrect ? (question.marks || 1) : 0
        });
      }
    }

    // Calculate total score
    let marksObtained = 0;
    answerDetails.forEach(ans => {
      marksObtained += ans.marksObtained;
    });

    const percentage = ((marksObtained / test.totalMarks) * 100).toFixed(2);
    const isPassed = marksObtained >= test.passingMarks;

    // Update attempt as submitted
    await Attempt.findOneAndUpdate(
      { student: studentId, test: test._id },
      {
        currentAnswers: parsedAnswers,
        score: marksObtained,
        submittedAt: new Date(),
        timeTaken: parseInt(timeTaken) || 0,
        isSubmitted: true
      }
    );

    // Create result record
    const result = await Result.create({
      student: studentId,
      test: test._id,
      answers: answerDetails,
      totalMarks: test.totalMarks,
      marksObtained: marksObtained,
      percentage: parseFloat(percentage),
      isPassed: isPassed,
      timeTaken: Math.floor((parseInt(timeTaken) || 0) / 60), // Convert to minutes
      startedAt: new Date(Date.now() - (parseInt(timeTaken) || 0) * 1000),
      submittedAt: new Date()
    });

    res.redirect('/student/test-result/' + result._id);
  } catch (error) {
    console.error('Error submitting test:', error);
    res.status(500).send('Error submitting test');
  }
});

// View test result
router.get('/test-result/:resultId', async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId)
      .populate('test')
      .populate('student', 'name email');

    if (!result) {
      return res.status(404).send('Result not found');
    }

    // Check if this result belongs to current student
    if (result.student._id.toString() !== req.session.user._id) {
      return res.status(403).send('Unauthorized');
    }

    res.render('student/test-result', { 
      result,
      test: result.test,
      percentage: result.percentage,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching result:', error);
    res.status(500).send('Error loading result');
  }
});

module.exports = router;
// View all my test results
router.get('/my-results', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    
    const studentId = req.session.user._id || req.session.user.id;
    
    const results = await Result.find({ student: studentId })
      .populate('test')
      .sort({ submittedAt: -1 });
    
    res.render('student/my-results', { 
      results,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).send('Error loading results');
  }
});
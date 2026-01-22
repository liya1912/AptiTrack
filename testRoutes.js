/*const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin, isStudent } = require('../middleware/auth');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const Result = require('../models/Result');

// Admin: Create test page
router.get("/create", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin/create-test", {
    user: req.session.user
  });
});

// Admin: Handle test creation
router.post("/create", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { title, description, category, duration, totalMarks, passingMarks, semester, startDate, endDate, instructions } = req.body;

    const test = await Test.create({
      title,
      description,
      category,
      duration,
      totalMarks,
      passingMarks,
      semester,
      startDate,
      endDate,
      instructions,
      createdBy: req.session.user.id
    });

    res.redirect(`/tests/${test._id}/add-questions`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating test");
  }
});

// Admin: Add questions page
router.get("/:id/add-questions", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    res.render("admin/add-questions", {
      user: req.session.user,
      test
    });
  } catch (error) {
    res.status(500).send("Error loading test");
  }
});

// Admin: Handle adding question
router.post("/:id/add-question", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { questionText, questionType, options, correctAnswer, marks, category, difficultyLevel, explanation } = req.body;

    const question = await Question.create({
      questionText,
      questionType,
      options: JSON.parse(options), // Parse options array
      correctAnswer,
      marks,
      category,
      difficultyLevel,
      explanation,
      createdBy: req.session.user.id
    });

    // Add question to test
    await Test.findByIdAndUpdate(req.params.id, {
      $push: { questions: question._id }
    });

    res.json({ success: true, message: "Question added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error adding question" });
  }
});

// Student: View available tests
router.get("/available", isAuthenticated, isStudent, async (req, res) => {
  try {
    const now = new Date();
    const tests = await Test.find({
      semester: req.session.user.semester,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort('-createdAt');

    res.render("student/available-tests", {
      user: req.session.user,
      tests
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading tests");
  }
});

// Student: Start test
router.get("/:id/start", isAuthenticated, isStudent, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');

    if (!test) {
      return res.status(404).send("Test not found");
    }

    // Check if already attempted
    const existingResult = await Result.findOne({
      student: req.session.user.id,
      test: test._id
    });

    if (existingResult) {
      return res.send("You have already attempted this test");
    }

    // Check for existing active attempt
    let attempt = await Attempt.findOne({
      student: req.session.user.id,
      test: test._id,
      isActive: true
    });

    if (!attempt) {
      const now = new Date();
      const endTime = new Date(now.getTime() + test.duration * 60000);
      
      attempt = await Attempt.create({
        student: req.session.user.id,
        test: test._id,
        startedAt: now,
        endTime: endTime
      });
    }

    // Don't send correct answers to view
    const questionsForStudent = test.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      marks: q.marks,
      category: q.category
    }));

    res.render("student/take-test", {
      user: req.session.user,
      test,
      questions: questionsForStudent,
      attempt
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error starting test");
  }
});

// Student: Submit test
router.post("/:id/submit", isAuthenticated, isStudent, async (req, res) => {
  try {
    const { answers } = req.body; // Array of {question: id, selectedAnswer: 'A'}

    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    const attempt = await Attempt.findOne({
      student: req.session.user.id,
      test: test._id,
      isActive: true
    });

    if (!attempt) {
      return res.status(400).json({ success: false, message: 'No active attempt found' });
    }

    // Evaluate answers
    let totalMarksObtained = 0;
    const evaluatedAnswers = [];
    const categoryWiseScore = {
      quantitativeAptitude: 0,
      logicalReasoning: 0,
      verbalAbility: 0,
      technicalSkills: 0
    };

    const parsedAnswers = JSON.parse(answers);

    for (const answer of parsedAnswers) {
      const question = test.questions.find(q => q._id.toString() === answer.question);
      if (question) {
        const isCorrect = question.correctAnswer === answer.selectedAnswer;
        const marksObtained = isCorrect ? question.marks : 0;
        totalMarksObtained += marksObtained;

        // Category-wise scoring
        const category = question.category.replace(/\s+/g, '');
        const categoryKey = category.charAt(0).toLowerCase() + category.slice(1);
        if (categoryWiseScore.hasOwnProperty(categoryKey)) {
          categoryWiseScore[categoryKey] += marksObtained;
        }

        evaluatedAnswers.push({
          question: question._id,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
          marksObtained
        });
      }
    }

    const percentage = (totalMarksObtained / test.totalMarks) * 100;
    const isPassed = totalMarksObtained >= test.passingMarks;

    // Create result
    const result = await Result.create({
      student: req.session.user.id,
      test: test._id,
      answers: evaluatedAnswers,
      totalMarks: test.totalMarks,
      marksObtained: totalMarksObtained,
      percentage: percentage.toFixed(2),
      isPassed,
      startedAt: attempt.startedAt,
      submittedAt: new Date(),
      timeTaken: Math.round((new Date() - attempt.startedAt) / 60000),
      categoryWiseScore
    });

    // Mark attempt as submitted
    attempt.isSubmitted = true;
    attempt.isActive = false;
    await attempt.save();

    // Calculate rank
    const allResults = await Result.find({ test: test._id }).sort('-marksObtained');
    for (let i = 0; i < allResults.length; i++) {
      allResults[i].rank = i + 1;
      await allResults[i].save();
    }

    res.json({ success: true, resultId: result._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Student: View result
router.get("/result/:id", isAuthenticated, isStudent, async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('test')
      .populate('answers.question');

    if (!result || result.student.toString() !== req.session.user.id) {
      return res.status(404).send("Result not found");
    }

    res.render("student/view-result", {
      user: req.session.user,
      result
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading result");
  }
});

// Advisor: View test results for their students
router.get("/:id/results", isAuthenticated, async (req, res) => {
  try {
    const results = await Result.find({ test: req.params.id })
      .populate('student', 'name email registrationNumber semester')
      .sort('-marksObtained');

    const test = await Test.findById(req.params.id);

    res.render("advisor/test-results", {
      user: req.session.user,
      test,
      results
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading results");
  }
});

module.exports = router;*/


const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin, isStudent } = require('../middleware/auth');

const Test = require('../models/Test');
const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const Result = require('../models/Result');

/* =========================
   ADMIN ROUTES
========================= */

// Admin: Create test page
router.get("/create", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin/create-test", {
    user: req.session.user
  });
});

// Admin: Handle test creation
router.post("/create", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      duration,
      totalMarks,
      passingMarks,
      semester,
      startDate,
      endDate,
      instructions
    } = req.body;

    const test = await Test.create({
      title,
      description,
      category,
      duration,
      totalMarks,
      passingMarks,
      semester,
      startDate,
      endDate,
      instructions,
      createdBy: req.session.user.id
    });

    res.redirect(`/tests/${test._id}/add-questions`);
  } catch (error) {
    console.error("Error creating test:", error);
    res.status(500).send("Error creating test");
  }
});

// Admin: Add questions page
router.get("/:id/add-questions", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');

    if (!test) {
      return res.status(404).send("Test not found");
    }

    res.render("admin/add-questions", {
      user: req.session.user,
      test
    });
  } catch (error) {
    console.error("Error loading test:", error);
    res.status(500).send("Error loading test");
  }
});

// Admin: Handle adding a question
router.post("/:id/add-question", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const {
      questionText,
      questionType,
      options,
      correctAnswer,
      marks,
      category,
      difficultyLevel,
      explanation
    } = req.body;

    const parsedOptions =
      typeof options === "string" ? JSON.parse(options) : options;

    const question = await Question.create({
      questionText,
      questionType,
      options: parsedOptions,
      correctAnswer,
      marks: parseInt(marks),
      category,
      difficultyLevel,
      explanation,
      createdBy: req.session.user.id
    });

    await Test.findByIdAndUpdate(req.params.id, {
      $push: { questions: question._id }
    });

    res.json({
      success: true,
      message: "Question added successfully",
      questionId: question._id
    });
  } catch (error) {
    console.error("Error adding question:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   STUDENT ROUTES
========================= */

// Student: View available tests
router.get("/available", isAuthenticated, isStudent, async (req, res) => {
  try {
    const now = new Date();

    const tests = await Test.find({
      semester: req.session.user.semester,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort("-createdAt");

    res.render("student/available-tests", {
      user: req.session.user,
      tests
    });
  } catch (error) {
    console.error("Error loading tests:", error);
    res.status(500).send("Error loading tests");
  }
});

// Student: Start test
router.get("/:id/start", isAuthenticated, isStudent, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate("questions");

    if (!test) {
      return res.status(404).send("Test not found");
    }

    const existingResult = await Result.findOne({
      student: req.session.user.id,
      test: test._id
    });

    if (existingResult) {
      return res.send("You have already attempted this test");
    }

    let attempt = await Attempt.findOne({
      student: req.session.user.id,
      test: test._id,
      isActive: true
    });

    if (!attempt) {
      const now = new Date();
      const endTime = new Date(now.getTime() + test.duration * 60000);

      attempt = await Attempt.create({
        student: req.session.user.id,
        test: test._id,
        startedAt: now,
        endTime
      });
    }

    const questionsForStudent = test.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      marks: q.marks,
      category: q.category
    }));

    res.render("student/take-test", {
      user: req.session.user,
      test,
      questions: questionsForStudent,
      attempt
    });
  } catch (error) {
    console.error("Error starting test:", error);
    res.status(500).send("Error starting test");
  }
});

// Student: Submit test
router.post("/:id/submit", isAuthenticated, isStudent, async (req, res) => {
  try {
    const parsedAnswers = JSON.parse(req.body.answers);

    const test = await Test.findById(req.params.id).populate("questions");
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const attempt = await Attempt.findOne({
      student: req.session.user.id,
      test: test._id,
      isActive: true
    });

    if (!attempt) {
      return res.status(400).json({ success: false, message: "No active attempt found" });
    }

    let totalMarksObtained = 0;
    const evaluatedAnswers = [];
    const categoryWiseScore = {
      quantitativeAptitude: 0,
      logicalReasoning: 0,
      verbalAbility: 0,
      technicalSkills: 0
    };

    for (const answer of parsedAnswers) {
      const question = test.questions.find(q => q._id.toString() === answer.question);
      if (!question) continue;

      const isCorrect = question.correctAnswer === answer.selectedAnswer;
      const marksObtained = isCorrect ? question.marks : 0;

      totalMarksObtained += marksObtained;

      const key =
        question.category.replace(/\s+/g, '').replace(/^./, c => c.toLowerCase());
      if (categoryWiseScore[key] !== undefined) {
        categoryWiseScore[key] += marksObtained;
      }

      evaluatedAnswers.push({
        question: question._id,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        marksObtained
      });
    }

    const percentage = ((totalMarksObtained / test.totalMarks) * 100).toFixed(2);
    const isPassed = totalMarksObtained >= test.passingMarks;

    const result = await Result.create({
      student: req.session.user.id,
      test: test._id,
      answers: evaluatedAnswers,
      totalMarks: test.totalMarks,
      marksObtained: totalMarksObtained,
      percentage,
      isPassed,
      startedAt: attempt.startedAt,
      submittedAt: new Date(),
      timeTaken: Math.round((new Date() - attempt.startedAt) / 60000),
      categoryWiseScore
    });

    attempt.isSubmitted = true;
    attempt.isActive = false;
    await attempt.save();

    const allResults = await Result.find({ test: test._id }).sort("-marksObtained");
    for (let i = 0; i < allResults.length; i++) {
      allResults[i].rank = i + 1;
      await allResults[i].save();
    }

    res.json({ success: true, resultId: result._id });
  } catch (error) {
    console.error("Error submitting test:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Student: View result
router.get("/result/:id", isAuthenticated, isStudent, async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate("test")
      .populate("answers.question");

    if (!result || result.student.toString() !== req.session.user.id) {
      return res.status(404).send("Result not found");
    }

    res.render("student/view-result", {
      user: req.session.user,
      result
    });
  } catch (error) {
    console.error("Error loading result:", error);
    res.status(500).send("Error loading result");
  }
});

/* =========================
   ADVISOR ROUTES
========================= */

// Advisor: View test results
router.get("/:id/results", isAuthenticated, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    const results = await Result.find({ test: req.params.id })
      .populate("student", "name email registrationNumber semester")
      .sort("-marksObtained");

    res.render("advisor/test-results", {
      user: req.session.user,
      test,
      results
    });
  } catch (error) {
    console.error("Error loading results:", error);
    res.status(500).send("Error loading results");
  }
});

module.exports = router;

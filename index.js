// Import necessary libraries
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

// Create an instance of the Express application
const app = express();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Set the port to listen for incoming requests
const port = process.env.PORT || 3000;

// Connect to the MongoDB database
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://vighdavid:vighdavid@cluster0.5t1mjxm.mongodb.net/codesnippets', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Handle MongoDB connection errors
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define the User model schema
const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    password: String,
}));

// Define the Snippet model schema
const Snippet = mongoose.model('Snippet', new mongoose.Schema({
    title: String,
    code: String,
    userId: String,
    comments: {
        type: [{
            text: String,
            lastEdited: {
                type: Date,
                default: Date.now,
            },
        }],
        default: [],
    },
    lastEdited: {
        type: Date,
        default: Date.now,
    },
}));

// Enable Cross-Origin Resource Sharing (CORS) middleware
app.use(cors());

// Use JSON body parser middleware
app.use(bodyParser.json());

// Define the route for the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Set the JWT secret key for authentication
const jwtSecret = process.env.SECRET_KEY || 'default_secret_key';

// Register a new user with username and hashed password
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await User.findOne({ username });
        if (!user && password.length >= 1 && username.length >= 1) {
            const user = new User({ username, password: hashedPassword });
            await user.save();
            res.status(201).json({ message: 'User registered successfully.' });
        } else {
            res.status(500).json({ message: 'Error while registering user.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error while registering user.' });
    }
});

// Login user and generate a JWT token for authentication
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ userId: user._id }, jwtSecret);
        res.status(200).json({ token });
    } catch (error) {
        console.error('Error while logging in: ', error);
        res.status(500).json({ message: 'Error while logging in.' });
    }
});

// Post a new code snippet for a specific user
app.post('/api/snippets', async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    try {
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized. Missing token.' });
        }

        const decoded = jwt.verify(token, jwtSecret);
        const userId = decoded.userId;
        const lastEdited = new Date();

        const { title, code } = req.body;
        const snippet = new Snippet({ title, code, userId, lastEdited });
        await snippet.save();

        res.status(201).json({ message: 'Snippet posted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error while posting the snippet.' });
    }
});

// Get paginated snippets
app.get('/api/snippets', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    try {
        const totalSnippets = await Snippet.countDocuments();
        const snippets = await Snippet.find()
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        res.status(200).json({
            snippets,
            totalSnippets,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error while fetching snippets.' });
    }
});

// Add a comment to a specific code snippet
app.post('/api/snippets/:id/comments', async (req, res) => {
    const { comment } = req.body;
    const snippetId = req.params.id;
    const lastEdited = new Date();

    try {
        const snippet = await Snippet.findById(snippetId);
        if (!snippet) {
            return res.status(404).json({ message: 'Snippet not found.' });
        }

        snippet.comments.push({ text: comment, lastEdited });
        await snippet.save();
        res.status(201).json({ message: 'Comment added successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error while adding comment.' });
    }
});

// Get comments for a specific code snippet
app.get('/api/snippets/:id/comments', async (req, res) => {
    const snippetId = req.params.id;

    try {
        const snippet = await Snippet.findById(snippetId);
        if (!snippet) {
            return res.status(404).json({ message: 'Snippet not found.' });
        }

        const comments = snippet.comments;
        res.status(200).json({ comments });
    } catch (error) {
        res.status(500).json({ message: 'Error while fetching comments.' });
    }
});

// Start the server and listen for incoming requests
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
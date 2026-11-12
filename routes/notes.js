const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Note = require('../models/Note');
const auth = require('../middleware/auth');

// Protect all note routes with authentication middleware
router.use(auth);

/**
 * POST /api/notes
 * Create a new note owned strictly by the authenticated user.
 */
router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body || {};

    // Validate presence and type of required fields
    if (typeof title !== 'string' || typeof content !== 'string') {
      return res.status(400).json({ message: 'Title and content must be valid text values' });
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent) {
      return res.status(400).json({ message: 'Title and content cannot be empty' });
    }

    // Security: Owner is explicitly taken from req.user (JWT payload), never trusted from req.body
    const note = new Note({
      title: trimmedTitle,
      content: trimmedContent,
      user: req.user,
    });

    const savedNote = await note.save();
    return res.status(201).json(savedNote);
  } catch (error) {
    console.error('Create note error:', error.message);
    return res.status(500).json({ message: 'Server error while creating note' });
  }
});

/**
 * GET /api/notes
 * Fetch all notes belonging exclusively to the authenticated user, ordered newest first.
 */
router.get('/', async (req, res) => {
  try {
    // Query filtered strictly by req.user to guarantee tenant isolation
    const notes = await Note.find({ user: req.user }).sort({ createdAt: -1 });
    return res.status(200).json(notes);
  } catch (error) {
    console.error('Fetch notes error:', error.message);
    return res.status(500).json({ message: 'Server error while fetching notes' });
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a specific note by ID only if it belongs to the authenticated user.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format before querying database
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid note ID format' });
    }

    // Atomic find and delete conditioned on both note _id AND authenticated user ID
    const deletedNote = await Note.findOneAndDelete({ _id: id, user: req.user });

    // If no note matched both conditions, return 404 (does not exist or belongs to someone else)
    if (!deletedNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    return res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error.message);
    return res.status(500).json({ message: 'Server error while deleting note' });
  }
});

module.exports = router;

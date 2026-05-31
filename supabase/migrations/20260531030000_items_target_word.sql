-- T3-D STS: store target word on the note; card type derived at ensureFlashcards time
ALTER TABLE ind_items ADD COLUMN target_word text;

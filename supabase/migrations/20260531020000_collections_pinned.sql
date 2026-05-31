-- T2-E: pin/favourite a deck to the top of My Collections
ALTER TABLE ind_learn_collections ADD COLUMN pinned boolean NOT NULL DEFAULT false;

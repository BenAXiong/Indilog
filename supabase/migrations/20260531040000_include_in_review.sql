-- T1-B: include_in_review toggle — exclude decks from "Review all" CTA
ALTER TABLE ind_learn_collections ADD COLUMN include_in_review boolean NOT NULL DEFAULT true;
ALTER TABLE ind_profiles ADD COLUMN include_in_review boolean NOT NULL DEFAULT true;

-- interval_days was int4, which silently truncated fractional intervals (e.g. 0.5d = 12h
-- graduation failed with "invalid input syntax for type integer: 0.5"). Alter to float4
-- to match ease_factor and support sub-day intervals from FormoSRS-1.
ALTER TABLE ind_flashcards ALTER COLUMN interval_days TYPE float4;

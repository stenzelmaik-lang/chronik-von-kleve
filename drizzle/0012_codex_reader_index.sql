CREATE TABLE `codex_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`heading` text NOT NULL,
	`plain_text` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `entity_content_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_codex_sections_block` ON `codex_sections` (`block_id`);
--> statement-breakpoint
-- External-content FTS is a rebuildable index, never a second book model.
CREATE VIRTUAL TABLE codex_fts USING fts5(heading, plain_text, content='codex_sections', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
--> statement-breakpoint
CREATE TRIGGER codex_sections_ai AFTER INSERT ON codex_sections BEGIN
  INSERT INTO codex_fts(rowid,heading,plain_text) VALUES(new.rowid,new.heading,new.plain_text);
END;
--> statement-breakpoint
CREATE TRIGGER codex_sections_ad AFTER DELETE ON codex_sections BEGIN
  INSERT INTO codex_fts(codex_fts,rowid,heading,plain_text) VALUES('delete',old.rowid,old.heading,old.plain_text);
END;
--> statement-breakpoint
CREATE TRIGGER codex_sections_au AFTER UPDATE ON codex_sections BEGIN
  INSERT INTO codex_fts(codex_fts,rowid,heading,plain_text) VALUES('delete',old.rowid,old.heading,old.plain_text);
  INSERT INTO codex_fts(rowid,heading,plain_text) VALUES(new.rowid,new.heading,new.plain_text);
END;

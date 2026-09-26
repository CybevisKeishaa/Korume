-- Editorial order inside a collection; 0 means unordered, so callers retain their existing order.
alter table lesson_collections add column position int not null default 0;

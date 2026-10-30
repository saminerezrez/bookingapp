-- migrate:up

create table bookings (
    id          bigserial primary key,
    name        text not null check (char_length(name) between 1 and 100),
    date        date not null,
    start_time  time not null,
    created_at  timestamptz not null default now(),
    constraint bookings_slot_unique unique (date, start_time)
);

-- migrate:down

drop table bookings;
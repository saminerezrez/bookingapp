-- migrate:up

create table bookings (
    id          bigserial primary key,
    name        text not null,
    date        date not null,
    start_time  time not null,
    created_at  timestamptz not null default now()
);

-- migrate:down

drop table bookings;
# FuelPoint — Backend

Backend for the FuelPoint admin panel, to be built with **Node.js** and **PostgreSQL**.

## Status

Not started. This folder only holds this README until the design is agreed.

## Scope

- **In scope:** the API and database that the admin panel in `../frontend` needs.
- **Out of scope:** the **mobile applications** (the worker app and the customer app). They are not part of our development here.

## Decided

- Runtime: Node.js
- Database: PostgreSQL

## Not decided yet

Web framework, database access layer/ORM, migration tool, authentication approach, API style and project layout inside this folder. These will be agreed and recorded here and in `../docs` before any code is written.

## Reference

The data the admin frontend currently works with (customers, workers, groups, transactions, notifications, admin profile) is defined in `../frontend/src/services/types.ts`.

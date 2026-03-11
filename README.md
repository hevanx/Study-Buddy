# Study Buddy

A study tracking web app with XP, ranks, cosmetics, and friends.

---

## Requirements

Before you start, make sure you have these installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — download and install for your operating system
- That's it

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/hevanx/study-buddy.git
cd study-buddy
```

### 2. Open Docker Desktop

Launch Docker Desktop and wait until it says **"Docker Desktop is running"** in the bottom left. It needs to be running before the next step.

### 3. Start the app

In your terminal, from inside the `study-buddy` folder, run:

```bash
docker-compose up
```

This will download and start everything automatically. The first time may take a minute or two. Wait until you see a line that says:

```
api-1  | [api] listening on port 3000
```

### 4. Open the app

Open your browser and go to:

```
http://localhost:8081
```

You should see the Study Buddy register page.

Create your own account with a username, email, and password. (you can use a fake email if you want)

---

## Sample Accounts

Five sample accounts are pre-loaded with different ranks so you can explore the app immediately:

| Username | Password | Rank |
|---|---|---|
| hevan | password123 | Diamond |
| alex_studies | studyhard | Gold |
| diamondDave | diamond99 | Silver |
| goldie | golduser | Bronze |
| silverstar | silverstar | Unranked |

---

## Dev Tools (for testing)

A **Dev Tools panel** is available on the main dashboard (bottom-right corner of the screen after logging in). It lets you instantly set your XP to any rank without having to study for hours.

This is included for easier testing and is **not a feature of the app itself**.

---

## Stopping the App

To stop the app, press `Ctrl + C` in the terminal where it's running.

To stop and remove everything (including the database):

```bash
docker-compose down -v
```

> **Note:** Using `-v` will wipe the database. When you run `docker-compose up` again, the sample data will be restored automatically from the SQL file.

---

## Troubleshooting

**Port already in use?**
Something else on your machine is using port 8081 or 3000. Stop that process or restart Docker Desktop.

**Page not loading?**
Make sure Docker Desktop is fully running, then wait a few extra seconds after `docker-compose up` finishes before opening the browser.

**Database looks empty?**
Run `docker-compose down -v` then `docker-compose up` to reset and reload the sample data.

# Study Buddy – Milestone 5 (Front-End)

This repository contains the Milestone 5 front-end implementation for the Study Buddy project. The goal of this milestone is to translate the high-fidelity prototype into executable, interactable HTML and CSS. The project is served locally using Docker and Docker Compose.

---

## Project Structure

.
├── docker-compose.yml
├── study-buddy-html/
│ ├── index.html
│ ├── login.html
│ ├── register.html
│ ├── friends.html
│ ├── leaderboard.html
│ ├── forgot-password.html
│ ├── template.html
│ ├── styles/
│ └── assets/
└── README.md


All website files live inside the `study-buddy-html` directory, which is mounted as the web root in Docker.

---

## Requirements

- Docker Desktop
- Docker Compose

Docker must be installed and running before starting the project.

---

## How to Run the Project Locally

From the root of the repository, run:

```bash
docker compose up
Once the container starts, open a browser and navigate to:

http://localhost:8080

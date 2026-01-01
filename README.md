# Subject Planning and Semester Management System

This repository contains a full-stack web application developed as a capstone project for Sunway University. The system allows students to visualise their academic structure and interactively plan future subjects, with a focus on usability, clarity, and interactivity.

The project integrates a ReactJS frontend, an ExpressJS backend, and an Apache Cassandra database to combine official programme cohort structures with real (anonymised) student subject attempts.

---

## Project Overview

Traditional subject planning is often carried out using static documents such as PDFs or spreadsheets, which provide limited interactivity and feedback. This project addresses that limitation by providing an interactive subject planning tool that visually represents a student’s academic journey across semesters and supports elective selection through direct manipulation.

Programme structures are defined using a custom Domain-Structured Language (DSL) format, which is parsed by the frontend to reconstruct the full degree layout. The backend retrieves real student subject attempts from Apache Cassandra, allowing the system to reflect completed and remaining subjects accurately.

---

## Key Features

- Year–semester based academic layout
- Visual subject cards with progress indication
- Interactive elective selection panel
- Drag-and-drop placement for elective subjects
- Overall academic progress visualisation
- Simple login using anonymised student credentials
- Evaluated using the System Usability Scale (SUS)

---

## Technologies Used

**Frontend**
- ReactJS
- JavaScript
- Tailwind CSS
- Vite

**Backend**
- Node.js
- ExpressJS

**Database**
- Apache Cassandra

**Other Tools**
- Custom DSL parser (frontend)
- IntelliJ IDEA Ultimate (development environment)
- npm (package management)

---

## Installation and Usage

### 1. Clone the repository

bash
git clone https://github.com/J0shir0/Subject-Planner.git
cd Subject-Planner

### 2. Install frontend dependencies
npm install

### 3. Start the backend server
cd server
npm install
node index.js

### 4. Start the frontend
npm run dev

Note: Apache Cassandra must be configured and running for the backend to retrieve real student subject attempts.

---

## Evaluation
The system was evaluated using the System Usability Scale (SUS) with Sunway University students. Results indicated that the planner was generally perceived as intuitive and easy to use, particularly due to its clear layout, drag-and-drop interactions, and visual progress indicators.

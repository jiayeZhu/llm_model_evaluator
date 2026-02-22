# LLM Model Evaluator

A full-stack application for evaluating and comparing Large Language Models (LLMs). This project provides a chat interface to interact with multiple models and backend infrastructure to support the evaluation process.

> **Note:** This project was developed using **Antigravity with Gemini 3.1 Pro**.

## Architecture

The application is structured as a full-stack project using Docker Compose for orchestration:

*   **Frontend**: A React application (built with Vite) that provides the user interface for chatting with and evaluating models.
*   **Backend**: A Python application (FastAPI) that handles the core logic, model interactions, and data management.
*   **Database**: A PostgreSQL database containerized for persistent data storage.

## Getting Started

### Prerequisites

*   Docker
*   Docker Compose

### Running the Application

1.  Clone the repository.
2.  Navigate to the project root.
3.  Ensure any necessary API keys or environment variables are configured (e.g., in a `.env` file).
4.  Run the application using Docker Compose:

    ```bash
    docker-compose up --build
    ```

5.  Access the application:
    *   Frontend: `http://localhost:5173` (or the port mapped in your docker-compose.yml)
    *   Backend API: `http://localhost:8000`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

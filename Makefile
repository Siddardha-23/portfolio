.PHONY: install run-backend run-frontend run

# Install dependencies for both frontend and backend
install:
	cd portfolio-backend && python -m venv env
	cd portfolio-backend && env/Scripts/pip install -r requirements.txt
	cd portfolio-frontend && npm install

# Run the backend server
run-backend:
	cd portfolio-backend && env/Scripts/python app.py

# Run the frontend development server
run-frontend:
	cd portfolio-frontend && npm run dev

# Run both services simultaneously
# Usage: make run
run:
	$(MAKE) -j 2 run-backend run-frontend

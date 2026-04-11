.PHONY: run install lint format

# Starts both backend and frontend automatically in separate cmd windows
run:
	@echo "Starting backend and frontend..."
	start "Portfolio Backend" cmd /k "cd portfolio-backend && if exist env\Scripts\activate.bat (env\Scripts\activate.bat) && python local.py"
	start "Portfolio Frontend" cmd /k "cd portfolio-frontend && pnpm dev"

# Helper target to install dependencies
install:
	@echo "Installing backend dependencies..."
	cd portfolio-backend && if exist env\Scripts\activate.bat (env\Scripts\activate.bat && pip install -r requirements.txt) else (pip install -r requirements.txt)
	@echo "Installing frontend dependencies..."
	cd portfolio-frontend && pnpm install

# Run linters for both environments
lint:
	@echo "Linting frontend..."
	-cd portfolio-frontend && pnpm lint
	@echo "Linting backend (if flake8/ruff is installed)..."
	-cd portfolio-backend && if exist env\Scripts\activate.bat (env\Scripts\activate.bat && flake8 .) else (flake8 .)

# Automatically format code for both environments
format:
	@echo "Formatting frontend..."
	cd portfolio-frontend && pnpm eslint ./src --fix
	@echo "Formatting backend (if black is installed)..."
	-cd portfolio-backend && if exist env\Scripts\activate.bat (env\Scripts\activate.bat && black .) else (black .)

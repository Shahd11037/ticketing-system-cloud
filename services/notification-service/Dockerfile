# 1. Use an official Python image
FROM python:3.9-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy your main.py code into the container
COPY main.py .

# 5. Run the script when the container starts
CMD ["python", "main.py"]

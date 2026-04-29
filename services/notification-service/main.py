import json
import pika
import threading
import psycopg2
from fastapi import FastAPI
import uvicorn
import os

app = FastAPI()

# Connection details (match your docker-compose.dev.yml)
DB_CONFIG = {
    "host": "db", # The service name in docker-compose
    "database": "ticketing_system",
    "user": "admin",
    "password": "password123"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

# --- 1. THE "WRITE" (RabbitMQ Callback) ---
def start_rabbitmq_consumer():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host='rabbitmq'))
    channel = connection.channel()
    channel.queue_declare(queue='task_queue', durable=True)

    def callback(ch, method, properties, body):
        # 1. Parse the JSON string into a Python Dictionary
        data = json.loads(body.decode())
        user_id = data.get("user_id")
        message = data.get("message")
        ticket_id = data.get("ticket_id")

        print(f" [x] Processing alert for User {user_id}: {message}")

        # --- DATABASE WRITE HAPPENS HERE ---
        conn = get_db_connection()
        cur = conn.cursor()
        # Note: In a real app, you'd parse user_id from the JSON message
        cur.execute(
            "INSERT INTO notifications (user_id, message) VALUES (%s, %s)",
            (user_id, message)
        )
        conn.commit()
        cur.close()
        conn.close()

        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue='task_queue', on_message_callback=callback)
    channel.start_consuming()

# --- 2. THE "READ" (API Endpoint) ---
@app.get("/notifications")
def get_notifications():
    # --- DATABASE READ HAPPENS HERE ---
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, user_id, message, sent_at FROM notifications ORDER BY sent_at DESC")
    rows = cur.fetchall()

    # Format the data into a list of dictionaries for the frontend
    results = []
    for row in rows:
        results.append({
            "id": row[0],
            "user_id": row[1],
            "message": row[2],
            "sent_at": row[3]
        })

    cur.close()
    conn.close()
    return results

if __name__ == "__main__":
    rabbit_thread = threading.Thread(target=start_rabbitmq_consumer, daemon=True)
    rabbit_thread.start()
    uvicorn.run(app, host="0.0.0.0", port=5000)

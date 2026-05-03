import json
import time
import logging
import psycopg2
import pika
import uvicorn
from fastapi import FastAPI, HTTPException

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SupportService")

DB_CONFIG = {
    "host": "db",
    "database": "ticketing_system",
    "user": "admin",
    "password": "password123"
}

RABBITMQ_HOST = "rabbitmq"


def get_db():
    for i in range(5):
        try:
            return psycopg2.connect(**DB_CONFIG)
        except psycopg2.OperationalError as e:
            logger.warning("DB not ready,againn (%d/5)", i + 1)
            time.sleep(2)
    raise Exception("failed to connect to database")


def send_notification(user_id, message):
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=RABBITMQ_HOST, heartbeat=30)
        )
        channel = connection.channel()
        channel.queue_declare(queue='task_queue', durable=True)
        channel.basic_publish(
            exchange='',
            routing_key='task_queue',
            body=json.dumps({"user_id": user_id, "message": message}),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        connection.close()
    except Exception as e:
        logger.error("failed to send notification: %s", e)


@app.get("/health")
def health():
    return {"status": "ok", "service": "support-service"}


# assign a ticket to a support agent
@app.post("/assign", status_code=201)
def assign_ticket(data: dict):
    if not data.get("ticket_id") or not data.get("agent_id"):
        raise HTTPException(status_code=400, detail="ticket_id and agent_id are required")

    conn = get_db()
    cur = conn.cursor()

    try:
        # check ticket exists
        cur.execute("SELECT id, status, created_by FROM tickets WHERE id = %s", (data["ticket_id"],))
        ticket = cur.fetchone()

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        if ticket[1] in ("resolved", "closed"):
            raise HTTPException(status_code=400, detail=f"Cannot assign a ticket with status '{ticket[1]}'")

        created_by = ticket[2]

        # check agent exists and has the right role
        cur.execute("SELECT id, role FROM users WHERE id = %s", (data["agent_id"],))
        agent = cur.fetchone()

        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        if agent[1] not in ("agent", "admin"):
            raise HTTPException(status_code=403, detail="User is not a support agent")

        # check not already assigned to this agent
        cur.execute("SELECT id FROM support_assignments WHERE ticket_id = %s AND agent_id = %s", (data["ticket_id"], data["agent_id"]))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Ticket already assigned to this agent")

        # create the assignment
        cur.execute(
            "INSERT INTO support_assignments (ticket_id, agent_id) VALUES (%s, %s) RETURNING id, ticket_id, agent_id, assigned_at",
            (data["ticket_id"], data["agent_id"])
        )
        row = cur.fetchone()

        # update ticket status to in_progress
        cur.execute("UPDATE tickets SET status = 'in_progress' WHERE id = %s", (data["ticket_id"],))
        conn.commit()

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error("error assigning ticket: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        cur.close()
        conn.close()

    send_notification(created_by, f"Your ticket #{data['ticket_id']} has been assigned to a support agent.")
    return {"id": row[0], "ticket_id": row[1], "agent_id": row[2], "assigned_at": str(row[3])}


# resolve a ticket with notes
@app.post("/resolve")
def resolve_ticket(data: dict):
    if not data.get("ticket_id") or not data.get("notes"):
        raise HTTPException(status_code=400, detail="ticket_id and notes are required")

    conn = get_db()
    cur = conn.cursor()

    try:
        # check ticket exists
        cur.execute("SELECT id, status, created_by FROM tickets WHERE id = %s", (data["ticket_id"],))
        ticket = cur.fetchone()

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        if ticket[1] == "resolved":
            raise HTTPException(status_code=400, detail="Ticket is already resolved")

        if ticket[1] == "closed":
            raise HTTPException(status_code=400, detail="Cannot resolve a closed ticket")

        created_by = ticket[2]

        # ticket lazem tkon assigned el awl
        cur.execute("SELECT id FROM support_assignments WHERE ticket_id = %s", (data["ticket_id"],))
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Ticket must be assigned to an agent before resolving")

        # save resolution notes and update ticket status
        cur.execute("UPDATE support_assignments SET resolution_notes = %s WHERE ticket_id = %s", (data["notes"], data["ticket_id"]))
        cur.execute("UPDATE tickets SET status = 'resolved' WHERE id = %s", (data["ticket_id"],))
        conn.commit()

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error("Error resolving ticket: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        cur.close()
        conn.close()

    send_notification(created_by, f"Your ticket #{data['ticket_id']} has been resolved. Notes: {data['notes']}")
    return {"message": "Ticket resolved", "ticket_id": data["ticket_id"]}



@app.post("/assignments/{ticket_id}/close")
def close_ticket(ticket_id: int):
    """Close a resolved ticket."""
    try:
        conn = get_db()
        cur = conn.cursor()
 
        cur.execute("SELECT id, status, created_by FROM tickets WHERE id = %s", (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
 
        if ticket[1] == "closed":
            raise HTTPException(status_code=400, detail="Ticket is already closed")
 
        customer_id = ticket[2]
 
        cur.execute("UPDATE tickets SET status = 'closed' WHERE id = %s", (ticket_id,))
        conn.commit()
        cur.close()
        conn.close()
 
        logger.info("Ticket #%s closed.", ticket_id)
 
        send_notification(
            user_id=customer_id,
            message=f"Your ticket #{ticket_id} has been closed. Thank you for contacting support."
        )
 
        return {"ticket_id": ticket_id, "status": "closed"}
 
    except HTTPException:
        raise
    except psycopg2.Error as e:
        logger.error("DB error closing ticket %s: %s", ticket_id, e)
        raise HTTPException(status_code=500, detail="Database error")



# get all assignments 
@app.get("/assignments")
def list_assignments(agent_id: int = None):
    conn = get_db()
    cur = conn.cursor()

    try:
        query = """
            SELECT sa.id, sa.ticket_id, sa.agent_id, sa.assigned_at, sa.resolution_notes, t.title, t.status
            FROM support_assignments sa
            JOIN tickets t ON sa.ticket_id = t.id
            WHERE 1=1
        """
        params = []

        if agent_id:
            query += " AND sa.agent_id = %s"
            params.append(agent_id)

        query += " ORDER BY sa.assigned_at DESC"
        cur.execute(query, params)
        rows = cur.fetchall()

    except Exception as e:
        logger.error("Error listing assignments: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        cur.close()
        conn.close()

    return [
        {"id": r[0], "ticket_id": r[1], "agent_id": r[2], "assigned_at": str(r[3]), "resolution_notes": r[4], "ticket_title": r[5], "ticket_status": r[6]}
        for r in rows
    ]


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
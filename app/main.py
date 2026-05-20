from fastapi import FastAPI, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import func
from sqlmodel import Session, select

from .db import engine, create_db, get_session
from .models import Todo

app = FastAPI()

app.mount("/static", StaticFiles(directory="app/static"), name="static")

templates = Jinja2Templates(directory="app/templates")
PAGE_SIZE = 5

@app.on_event("startup")
def on_startup():
    create_db()


def parse_int(value, default: int = 1) -> int:
    try:
        return max(int(value), 1)
    except (TypeError, ValueError):
        return default


def validate_title(title: str) -> tuple[str, str | None]:
    title = title.strip()
    if not title:
        return title, "Title is required."
    if len(title) > 200:
        return title, "Title must be 200 characters or fewer."
    return title, None


def get_todo_list(session: Session, q: str = "", page: int = 1):
    q = q.strip()
    base_query = select(Todo)
    count_query = select(func.count()).select_from(Todo)

    if q:
        base_query = base_query.where(Todo.title.contains(q))
        count_query = count_query.where(Todo.title.contains(q))

    total = session.exec(count_query).one()
    total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page = min(max(page, 1), total_pages)

    todos = (
        session.exec(
            base_query.order_by(Todo.id)
            .offset((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
        )
        .all()
    )

    return todos, page, total_pages


def render_todo_list(
    request: Request,
    todos,
    current_page: int,
    total_pages: int,
    q: str = "",
    message: str | None = None,
    message_type: str = "info",
):
    return templates.TemplateResponse(
        request,
        "todo_list.html",
        {
            "todos": todos,
            "current_page": current_page,
            "total_pages": total_pages,
            "q": q,
            "message": message,
            "message_type": message_type,
        }
    )


def render_todo_item(request: Request, todo: Todo, edit: bool = False, message: str | None = None, message_type: str = "info"):
    q = request.query_params.get("q", "")
    current_page = parse_int(request.query_params.get("page", 1))
    return templates.TemplateResponse(
        request,
        "todo_item.html",
        {
            "todo": todo,
            "edit": edit,
            "q": q,
            "current_page": current_page,
            "message": message,
            "message_type": message_type,
        }
    )

@app.get("/todos/{todo_id}", response_class=HTMLResponse)
def get_todo_item(todo_id: int, request: Request, session: Session = Depends(get_session)):
    todo = session.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return render_todo_item(request, todo)


@app.get("/todos/{todo_id}/edit", response_class=HTMLResponse)
def edit_todo_form(todo_id: int, request: Request, session: Session = Depends(get_session)):
    todo = session.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return render_todo_item(request, todo, edit=True)


@app.post("/todos/{todo_id}/edit", response_class=HTMLResponse)
def submit_todo_edit(
    todo_id: int,
    request: Request,
    title: str = Form(...),
    session: Session = Depends(get_session)
):
    title, error = validate_title(title)
    q = request.query_params.get("q", "")
    page = parse_int(request.query_params.get("page", 1))

    if error:
        todos, page, total_pages = get_todo_list(session, q, page)
        return render_todo_list(
            request,
            todos,
            page,
            total_pages,
            q,
            message=error,
            message_type="danger",
        )

    todo = session.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    todo.title = title
    session.add(todo)
    session.commit()
    session.refresh(todo)

    todos, page, total_pages = get_todo_list(session, q, page)
    return render_todo_list(
        request,
        todos,
        page,
        total_pages,
        q,
        message="Todo updated successfully.",
        message_type="success",
    )


@app.get("/", response_class=HTMLResponse)
def home(
    request: Request,
    q: str = "",
    page: int = 1,
    session: Session = Depends(get_session),
):
    todos, page, total_pages = get_todo_list(session, q, page)

    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "todos": todos,
            "current_page": page,
            "total_pages": total_pages,
            "q": q,
        }
    )


@app.post("/todos", response_class=HTMLResponse)
def create_todo(
    request: Request,
    title: str = Form(...),
    q: str = Form(""),
    page: int = Form(1),
    session: Session = Depends(get_session)
):
    title, error = validate_title(title)
    if error:
        todos, page, total_pages = get_todo_list(session, q, page)
        return render_todo_list(
            request,
            todos,
            page,
            total_pages,
            q,
            message=error,
            message_type="danger",
        )

    todo = Todo(title=title)
    session.add(todo)
    session.commit()

    todos, page, total_pages = get_todo_list(session, q, page)
    return render_todo_list(
        request,
        todos,
        page,
        total_pages,
        q,
        message="Todo created successfully.",
        message_type="success",
    )


@app.post("/todos/{todo_id}/toggle", response_class=HTMLResponse)
def toggle_todo(
    todo_id: int,
    request: Request,
    session: Session = Depends(get_session)
):
    todo = session.get(Todo, todo_id)
    message = None
    message_type = "success"

    if todo:
        todo.completed = not todo.completed
        session.add(todo)
        session.commit()
        message = "Todo marked completed." if todo.completed else "Todo marked incomplete."
    else:
        message = "Todo not found."
        message_type = "danger"

    q = request.query_params.get("q", "")
    page = parse_int(request.query_params.get("page", 1))
    todos, page, total_pages = get_todo_list(session, q, page)
    return render_todo_list(
        request,
        todos,
        page,
        total_pages,
        q,
        message=message,
        message_type=message_type,
    )


@app.post("/todos/{todo_id}/delete", response_class=HTMLResponse)
def delete_todo(
    todo_id: int,
    request: Request,
    session: Session = Depends(get_session)
):
    todo = session.get(Todo, todo_id)
    if todo:
        session.delete(todo)
        session.commit()
        message = "Todo deleted successfully."
        message_type = "success"
    else:
        message = "Todo not found."
        message_type = "danger"

    q = request.query_params.get("q", "")
    page = parse_int(request.query_params.get("page", 1))
    todos, page, total_pages = get_todo_list(session, q, page)
    return render_todo_list(
        request,
        todos,
        page,
        total_pages,
        q,
        message=message,
        message_type=message_type,
    )
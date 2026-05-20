from fastapi import FastAPI, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from .db import engine, create_db, get_session
from .models import Todo

app = FastAPI()

app.mount("/static", StaticFiles(directory="app/static"), name="static")

templates = Jinja2Templates(directory="app/templates")

@app.on_event("startup")
def on_startup():
    create_db()


def render_todo_item(request: Request, todo: Todo, edit: bool = False):
    return templates.TemplateResponse(
        request,
        "todo_item.html",
        {
            "todo": todo,
            "edit": edit
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
    todo = session.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    todo.title = title
    session.add(todo)
    session.commit()
    session.refresh(todo)
    return render_todo_item(request, todo)


@app.get("/", response_class=HTMLResponse)
def home(request: Request, session: Session = Depends(get_session)):
    todos = session.exec(select(Todo)).all()

    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "todos": todos
        }
    )


@app.post("/todos", response_class=HTMLResponse)
def create_todo(
    request: Request,
    title: str = Form(...),
    session: Session = Depends(get_session)
):
    todo = Todo(title=title)

    session.add(todo)
    session.commit()

    todos = session.exec(select(Todo)).all()

    return templates.TemplateResponse(
        request,
        "todo_list.html",
        {
            "todos": todos
        }
    )


@app.post("/todos/{todo_id}/toggle", response_class=HTMLResponse)
def toggle_todo(
    todo_id: int,
    request: Request,
    session: Session = Depends(get_session)
):
    todo = session.get(Todo, todo_id)

    if todo:
        todo.completed = not todo.completed
        session.add(todo)
        session.commit()

    todos = session.exec(select(Todo)).all()

    return templates.TemplateResponse(
        request,
        "todo_list.html",
        {
            "todos": todos
        }
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

    todos = session.exec(select(Todo)).all()

    return templates.TemplateResponse(
        request,
        "todo_list.html",
        {
            "todos": todos
        }
    )
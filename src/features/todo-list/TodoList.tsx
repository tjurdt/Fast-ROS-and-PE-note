import { createTodo, sortTodos, type Todo } from "../../domain/note-workspace";
import { Button } from "../../ui/Button";

interface TodoListProps {
  todos: Todo[];
  createId: () => string;
  now: () => number;
  onChange: (todos: Todo[]) => void;
}

function formatShortTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TodoList({ todos, createId, now, onChange }: TodoListProps) {
  const ordered = sortTodos(todos);
  const update = (id: string, patch: Partial<Todo>) =>
    onChange(todos.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo)));

  return (
    <section className="v2-card v2-workspace-card" aria-labelledby="todo-title">
      <div className="v2-workspace-heading">
        <div>
          <span className="v2-eyebrow">To-do</span>
          <h2 id="todo-title">待辦事項</h2>
        </div>
        <Button
          onClick={() => onChange([...todos, createTodo({ createId, now })])}
          tone="primary"
        >
          ＋ 新增
        </Button>
      </div>

      {ordered.length === 0 ? (
        <p className="v2-workspace-empty">尚無待辦，點「＋ 新增」開始。</p>
      ) : (
        <div className="v2-todo-list">
          {ordered.map((todo) => (
            <article
              className={`v2-todo ${todo.status === "done" ? "is-done" : ""} ${todo.important && todo.status !== "done" ? "is-important" : ""}`}
              key={todo.id}
            >
              <Button
                aria-label={`${todo.text || "未命名待辦"}：${todo.important ? "取消重要" : "設為重要"}`}
                aria-pressed={todo.important}
                className="v2-todo__star"
                onClick={() => update(todo.id, { important: !todo.important })}
              >
                ★
              </Button>
              <textarea
                aria-label="待辦內容"
                placeholder="待辦內容…"
                rows={1}
                value={todo.text}
                onChange={(event) => update(todo.id, { text: event.target.value })}
              />
              <div className="v2-todo__actions">
                <Button
                  aria-label={`${todo.text || "未命名待辦"}：待辦`}
                  aria-pressed={todo.status === "todo"}
                  className={todo.status === "todo" ? "is-selected" : ""}
                  onClick={() => update(todo.id, { status: "todo" })}
                >
                  待
                </Button>
                <Button
                  aria-label={`${todo.text || "未命名待辦"}：完成`}
                  aria-pressed={todo.status === "done"}
                  className={todo.status === "done" ? "is-selected" : ""}
                  onClick={() => update(todo.id, { status: "done" })}
                >
                  完
                </Button>
                <Button
                  aria-label={`${todo.text || "未命名待辦"}：刪除`}
                  className="v2-todo__delete"
                  onClick={() =>
                    onChange(todos.filter((candidate) => candidate.id !== todo.id))
                  }
                >
                  ✕
                </Button>
              </div>
              <time dateTime={new Date(todo.createdAt).toISOString()}>
                {formatShortTimestamp(todo.createdAt)}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

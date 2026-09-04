import type { CranialNerveDefinition } from "../../domain/clinical/catalog-schema";
import type { CranialNerveState, FindingValue } from "../../domain/clinical/finding";
import { Button } from "../../ui/Button";

interface CranialNerveWidgetProps {
  definitions: CranialNerveDefinition[];
  finding: FindingValue;
  onChange: (finding: FindingValue) => void;
}

export function CranialNerveWidget({
  definitions,
  finding,
  onChange,
}: CranialNerveWidgetProps) {
  const cranialNerves = finding.cn ?? {};
  const commit = (id: string, state: CranialNerveState) =>
    onChange({
      ...finding,
      cn: { ...cranialNerves, [id]: state },
    });

  return (
    <div className="v2-cn-panel" data-testid="cranial-nerve-widget">
      {definitions.map((definition) => {
        const state = cranialNerves[definition.id] ?? {};
        const abnormal = state.abn === true;
        const grid = state.grid ?? {};
        const mono = state.mono ?? [];

        return (
          <section
            className={`v2-cn-row ${abnormal ? "is-positive" : ""}`}
            data-testid={`cn-${definition.id}`}
            key={definition.id}
          >
            <div className="v2-cn-row__top">
              <Button
                aria-label={`${definition.label}：${abnormal ? "異常" : "正常"}`}
                className={abnormal ? "is-positive" : ""}
                data-testid={`cn-toggle-${definition.id}`}
                onClick={() =>
                  commit(
                    definition.id,
                    abnormal
                      ? { ...state, abn: false, grid: {}, mono: [], note: "" }
                      : {
                          ...state,
                          abn: true,
                          grid,
                          mono,
                          note: state.note ?? "",
                        },
                  )
                }
              >
                {abnormal ? "異常" : "正常"}
              </Button>
              <strong>{definition.label}</strong>
            </div>

            {abnormal ? (
              <div className="v2-cn-row__detail">
                {definition.sides.length > 0 ? (
                  <div className="v2-cn-grid">
                    <div className="v2-widget-grid__header" aria-hidden="true">
                      <span />
                      <span>左 L</span>
                      <span>右 R</span>
                    </div>
                    {definition.sides.map((side) => (
                      <div className="v2-widget-grid__row" key={side.k}>
                        <span>{side.l}</span>
                        {(["L", "R"] as const).map((bodySide) => {
                          const key = `${side.k}_${bodySide}`;
                          const selected = grid[key] === true;
                          return (
                            <Button
                              aria-label={`${definition.label} ${side.l} ${bodySide === "L" ? "左" : "右"}`}
                              aria-pressed={selected}
                              className={`v2-grid-cell ${selected ? "is-selected" : ""}`}
                              data-testid={`cn-cell-${definition.id}-${key}`}
                              key={bodySide}
                              onClick={() =>
                                commit(definition.id, {
                                  ...state,
                                  abn: true,
                                  grid: { ...grid, [key]: !selected },
                                  mono,
                                  note: state.note ?? "",
                                })
                              }
                            >
                              {selected ? "✓" : ""}
                            </Button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}

                {definition.mono.length > 0 ? (
                  <div className="v2-choice-chips">
                    {definition.mono.map((description) => {
                      const selected = mono.includes(description);
                      return (
                        <Button
                          aria-pressed={selected}
                          className={selected ? "is-selected" : ""}
                          key={description}
                          onClick={() =>
                            commit(definition.id, {
                              ...state,
                              abn: true,
                              grid,
                              mono: selected
                                ? mono.filter((value) => value !== description)
                                : [...mono, description],
                              note: state.note ?? "",
                            })
                          }
                        >
                          {description}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}

                <textarea
                  aria-label={`${definition.label}其他描述`}
                  placeholder="其他描述（自由填寫）"
                  rows={1}
                  value={state.note ?? ""}
                  onChange={(event) =>
                    commit(definition.id, {
                      ...state,
                      abn: true,
                      grid,
                      mono,
                      note: event.target.value,
                    })
                  }
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

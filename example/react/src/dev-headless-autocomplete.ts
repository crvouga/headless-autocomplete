/**
 * @category Config
 * @description
 * The Config<TItem> represents the configuration needed for the autocomplete to work with generic items.
 * ⚠️ All these functions should be deterministic!
 */
export type Config<TItem> = {
  toItemId: (item: TItem) => string;
  toItemInputValue: (item: TItem) => string;
  deterministicFilter: (model: Model<TItem>) => TItem[];
  namespace: string;
};

/**
 * @category Config
 */
export const initConfig = <TItem>({
  namespace,
  ...config
}: {
  toItemId: (item: TItem) => string;
  toItemInputValue: (item: TItem) => string;
  deterministicFilter?: (model: Model<TItem>) => TItem[];
  namespace?: string;
}): Config<TItem> => {
  return {
    ...config,
    namespace: namespace ?? "autocomplete",
    deterministicFilter: (model) => simpleFilter(config, model),
  };
};

/**
 * @category Config
 * @description
 * The simpleFilter function is a default implementation of the deterministicFilter function.
 */
export const simpleFilter = <TItem>(
  config: Pick<Config<TItem>, "toItemInputValue">,
  model: Model<TItem>
) => {
  return model.allItems.filter((item) =>
    config
      .toItemInputValue(item)
      .toLowerCase()
      .includes(toCurrentInputValue(config, model).toLowerCase())
  );
};

/**
 * @category Model
 * @description
 * The Model<TItem> represents the state of the autocomplete.
 */
export type Model<TItem> = ModelState<TItem> & {
  allItems: TItem[];
  skipOnce: Msg<TItem>["type"][];
};

type UnselectedBlurred = {
  type: "unselected__blurred";
};

type UnselectedFocusedOpened = {
  type: "unselected__focused__opened";
  inputValue: string;
};

type UnselectedFocusedOpenedHighlighted = {
  type: "unselected__focused__opened__highlighted";
  inputValue: string;
  highlightIndex: number;
};

type UnselectedFocusedClosed = {
  type: "unselected__focused__closed";
  inputValue: string;
};

type SelectedBlurred<TItem> = {
  type: "selected__blurred";
  selected: TItem;
};

type SelectedFocusedClosed<TItem> = {
  type: "selected__focused__closed";
  inputValue: string;
  selected: TItem;
};

type SelectedFocusedOpened<TItem> = {
  type: "selected__focused__opened";
  selected: TItem;
  inputValue: string;
};

type SelectedFocusedOpenedHighlighted<TItem> = {
  type: "selected__focused__opened__highlighted";
  selected: TItem;
  inputValue: string;
  highlightIndex: number;
};

/**
 * @category Model
 */
export type ModelState<TItem> =
  | UnselectedBlurred
  | UnselectedFocusedOpened
  | UnselectedFocusedOpenedHighlighted
  | UnselectedFocusedClosed
  | SelectedBlurred<TItem>
  | SelectedFocusedClosed<TItem>
  | SelectedFocusedOpened<TItem>
  | SelectedFocusedOpenedHighlighted<TItem>;

/**
 * @category Model
 * @description
 * The init function returns the initial state of the autocomplete.
 */
export const init = <TItem>({
  allItems,
}: {
  allItems: TItem[];
}): Model<TItem> => {
  return {
    type: "unselected__blurred",
    allItems,
    skipOnce: [],
  };
};

/**
 * @category Update
 * @description
 * The Msg<TItem> represents all the possible state transitions that can happen to the autocomplete.
 */
export type Msg<TItem> =
  | {
      type: "pressed-arrow-key";
      key: "arrow-up" | "arrow-down";
    }
  | {
      type: "pressed-escape-key";
    }
  | {
      type: "pressed-enter-key";
    }
  | {
      type: "pressed-item";
      item: TItem;
    }
  | {
      type: "focused-input";
    }
  | {
      type: "blurred-input";
    }
  | {
      type: "inputted-value";
      inputValue: string;
    }
  | {
      type: "hovered-over-item";
      index: number;
    }
  | {
      type: "pressed-input";
    };

/**
 * @category Update
 * @description
 * The Effect<TItem> represents all the possible effects that can happen to the autocomplete.
 * You as the user of the library has to implement the side effects
 **/
export type Effect<TItem> = {
  type: "scroll-item-into-view";
  item: TItem;
};

/**
 * @category Update
 * @description
 * The update function is the main function.
 * The update function takes the current state of the autocomplete and a message and returns the new state of the
 * autocomplete and effects that need to be run.
 */
export const update = <TItem>(
  config: Config<TItem>,
  {
    msg,
    model,
  }: {
    model: Model<TItem>;
    msg: Msg<TItem>;
  }
): {
  model: Model<TItem>;
  effects: Effect<TItem>[];
} => {
  if (model.skipOnce.includes(msg.type)) {
    return {
      model: {
        ...model,
        skipOnce: removeFirst((m) => m === msg.type, model.skipOnce),
      },
      effects: [],
    };
  }

  const modelUpdated = updateModel(config, { msg, model });

  const effects = toEffects(config, {
    msg,
    prev: model,
    next: modelUpdated,
  });

  /**

   ⚠️ Edge case

   ⏱ Happens when:
   Dropdown transitions from closed to open state and the mouse is hovering where the the dropdown renders.

   🤔 Expected Behavior:
   The state is in an opened but not highlighted state.

   😑 Actual Behavior:
   The state is opened then an unwanted hover message changes the state to a highlighted state.

   */
  if (
    isClosed(model) &&
    isOpened(modelUpdated) &&
    effects.some((effect) => effect.type === "scroll-item-into-view")
  ) {
    return {
      model: {
        ...modelUpdated,
        skipOnce: ["hovered-over-item", "hovered-over-item"],
      },
      effects: effects,
    };
  }

  if (isClosed(model) && isOpened(modelUpdated)) {
    return {
      model: { ...modelUpdated, skipOnce: ["hovered-over-item"] },
      effects: effects,
    };
  }

  /**

   ⚠️ Edge case

   ⏱ Happens when:
   Hovering over an item with the mouse and then scrolling to the next item with the keyboard.

   🤔 Expected Behavior:
   The item the keyboard navigated to is scrolled into view.

   😑 Actual Behavior:
   The item that was hovered over is scrolled into view.

   */
  if (effects.some((effect) => effect.type === "scroll-item-into-view")) {
    return {
      model: { ...modelUpdated, skipOnce: ["hovered-over-item"] },
      effects: effects,
    };
  }

  return {
    model: modelUpdated,
    effects: effects,
  };
};

const removeFirst = <T>(predicate: (x: T) => boolean, arr: T[]): T[] => {
  const index = arr.findIndex(predicate);
  if (index === -1) return arr;
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
};

const toEffects = <TItem>(
  config: Config<TItem>,
  {
    prev,
    next,
    msg,
  }: {
    prev: Model<TItem>;
    next: Model<TItem>;
    msg: Msg<TItem>;
  }
): Effect<TItem>[] => {
  const effects: Effect<TItem>[] = [];

  // scroll to selected item into view when state changes from closed to opened
  if (isClosed(prev) && isOpened(next) && isSelected(next)) {
    effects.push({
      type: "scroll-item-into-view",
      item: next.selected,
    });
  }

  // scroll highlighted item into view when navigating with keyboard
  if (isHighlighted(next) && msg.type === "pressed-arrow-key") {
    const filtered = config.deterministicFilter(next);

    const highlightedItem = filtered[next.highlightIndex];

    if (highlightedItem) {
      effects.push({
        type: "scroll-item-into-view",
        item: highlightedItem,
      });
    }
  }

  return effects;
};

const updateModel = <TItem>(
  { toItemInputValue, toItemId, deterministicFilter }: Config<TItem>,
  {
    model,
    msg,
  }: {
    model: Model<TItem>;
    msg: Msg<TItem>;
  }
): Model<TItem> => {
  switch (model.type) {
    case "selected__blurred": {
      switch (msg.type) {
        case "focused-input": {
          return {
            ...model,
            type: "selected__focused__opened",
            inputValue: toItemInputValue(model.selected),
            selected: model.selected,
          };
        }
        default: {
          return model;
        }
      }
    }

    case "selected__focused__closed": {
      switch (msg.type) {
        case "pressed-input": {
          return { ...model, type: "selected__focused__opened" };
        }

        case "blurred-input": {
          return { ...model, type: "selected__blurred" };
        }

        case "inputted-value": {
          if (msg.inputValue === "") {
            return {
              ...model,
              inputValue: msg.inputValue,
              type: "unselected__focused__opened",
            };
          }
          return {
            ...model,
            inputValue: msg.inputValue,
            type: "selected__focused__opened",
          };
        }

        case "pressed-arrow-key": {
          return {
            ...model,
            inputValue: model.inputValue,
            type: "selected__focused__opened",
          };
        }

        default: {
          return model;
        }
      }
    }

    case "selected__focused__opened": {
      switch (msg.type) {
        case "hovered-over-item": {
          return {
            ...model,
            type: "selected__focused__opened__highlighted",
            highlightIndex: msg.index,
          };
        }
        case "blurred-input": {
          return {
            ...model,
            type: "selected__blurred",
            selected: model.selected,
          };
        }

        case "pressed-item": {
          return {
            ...model,
            type: "selected__focused__closed",
            inputValue: toItemInputValue(model.selected),
            selected: msg.item,
          };
        }

        case "inputted-value": {
          if (msg.inputValue === "") {
            return {
              ...model,
              inputValue: "",
              type: "unselected__focused__opened",
            };
          }
          return { ...model, inputValue: msg.inputValue };
        }

        case "pressed-enter-key": {
          return {
            ...model,
            inputValue: toItemInputValue(model.selected),
            type: "selected__focused__closed",
          };
        }

        case "pressed-arrow-key": {
          const filtered = deterministicFilter(model);

          const selectedIndex = filtered.findIndex(
            (item) => toItemId(item) === toItemId(model.selected)
          );

          if (selectedIndex === -1) {
            return {
              ...model,
              highlightIndex: 0,
              type: "selected__focused__opened__highlighted",
            };
          }

          const delta = msg.key === "arrow-down" ? 1 : -1;

          const highlightIndex = circularIndex(
            selectedIndex + delta,
            filtered.length
          );

          return {
            ...model,
            highlightIndex,
            type: "selected__focused__opened__highlighted",
          };
        }

        case "pressed-escape-key": {
          return {
            ...model,
            type: "selected__focused__closed",
          };
        }

        default: {
          return model;
        }
      }
    }

    case "selected__focused__opened__highlighted": {
      switch (msg.type) {
        case "hovered-over-item": {
          return { ...model, highlightIndex: msg.index };
        }

        case "blurred-input": {
          return { ...model, type: "selected__blurred" };
        }

        case "pressed-item": {
          return {
            ...model,
            type: "selected__focused__closed",
            inputValue: toItemInputValue(msg.item),
            selected: msg.item,
          };
        }

        case "inputted-value": {
          if (msg.inputValue === "") {
            return {
              ...model,
              inputValue: "",
              type: "unselected__focused__opened",
            };
          }
          return { ...model, inputValue: msg.inputValue };
        }

        case "pressed-arrow-key": {
          const filtered = deterministicFilter(model);
          const delta = msg.key === "arrow-down" ? 1 : -1;
          const highlightIndex = circularIndex(
            model.highlightIndex + delta,
            filtered.length
          );
          return { ...model, highlightIndex };
        }

        case "pressed-enter-key": {
          const filtered = deterministicFilter(model);

          const selectedNew = filtered[model.highlightIndex];

          if (!selectedNew) {
            return { ...model, type: "selected__focused__closed" };
          }

          return {
            ...model,
            inputValue: toItemInputValue(selectedNew),
            selected: selectedNew,
            type: "selected__focused__closed",
          };
        }

        case "pressed-escape-key": {
          return { ...model, type: "selected__focused__closed" };
        }

        default: {
          return model;
        }
      }
    }

    case "unselected__blurred": {
      switch (msg.type) {
        case "focused-input": {
          return {
            ...model,
            type: "unselected__focused__opened",
            inputValue: "",
          };
        }
        default: {
          return model;
        }
      }
    }

    case "unselected__focused__closed": {
      switch (msg.type) {
        case "pressed-input": {
          return { ...model, type: "unselected__focused__opened" };
        }

        case "blurred-input": {
          return { ...model, type: "unselected__blurred" };
        }
        case "inputted-value": {
          return {
            ...model,
            type: "unselected__focused__opened",
            inputValue: msg.inputValue,
          };
        }

        case "pressed-arrow-key": {
          return { ...model, type: "unselected__focused__opened" };
        }

        default: {
          return model;
        }
      }
    }

    case "unselected__focused__opened": {
      switch (msg.type) {
        case "hovered-over-item": {
          return {
            ...model,
            type: "unselected__focused__opened__highlighted",
            highlightIndex: msg.index,
          };
        }

        case "blurred-input": {
          return { ...model, type: "unselected__blurred" };
        }

        case "pressed-item": {
          return {
            ...model,
            type: "selected__focused__closed",
            selected: msg.item,
            inputValue: toItemInputValue(msg.item),
          };
        }

        case "inputted-value": {
          return { ...model, inputValue: msg.inputValue };
        }

        case "pressed-arrow-key": {
          const filtered = deterministicFilter(model);
          const highlightIndex =
            msg.key === "arrow-up" ? filtered.length - 1 : 0;

          return {
            ...model,
            type: "unselected__focused__opened__highlighted",
            highlightIndex,
          };
        }

        case "pressed-escape-key": {
          return { ...model, type: "unselected__focused__closed" };
        }

        default: {
          return model;
        }
      }
    }

    case "unselected__focused__opened__highlighted": {
      switch (msg.type) {
        case "hovered-over-item": {
          return { ...model, highlightIndex: msg.index };
        }

        case "blurred-input": {
          return { ...model, type: "unselected__blurred" };
        }

        case "pressed-item": {
          return {
            ...model,
            type: "selected__focused__closed",
            selected: msg.item,
            inputValue: toItemInputValue(msg.item),
          };
        }

        case "inputted-value": {
          return {
            ...model,
            type: "unselected__focused__opened",
            inputValue: msg.inputValue,
          };
        }

        case "pressed-arrow-key": {
          const filtered = deterministicFilter(model);
          const delta = msg.key === "arrow-down" ? 1 : -1;
          const highlightIndex = circularIndex(
            model.highlightIndex + delta,
            filtered.length
          );
          return {
            ...model,
            highlightIndex,
          };
        }

        case "pressed-enter-key": {
          const filtered = deterministicFilter(model);

          const selectedNew = filtered[model.highlightIndex];

          if (!selectedNew) {
            return { ...model, type: "unselected__focused__closed" };
          }

          return {
            ...model,
            inputValue: toItemInputValue(selectedNew),
            selected: selectedNew,
            type: "selected__focused__closed",
          };
        }

        case "pressed-escape-key": {
          return {
            ...model,
            type: "unselected__focused__closed",
          };
        }
        default: {
          return model;
        }
      }
    }

    default: {
      const exhaustive: never = model;
      return exhaustive;
    }
  }
};

const circularIndex = (index: number, length: number) => {
  if (length === 0) {
    return 0;
  }
  return ((index % length) + length) % length;
};

/**
 * @category Selectors
 * @description
 * Utility function to determine if any item is selected.
 */
export const isSelected = <TItem>(
  model: ModelState<TItem>
): model is SelectedState<TItem> => {
  return (
    model.type === "selected__focused__opened" ||
    model.type === "selected__focused__opened__highlighted" ||
    model.type === "selected__blurred" ||
    model.type === "selected__focused__closed"
  );
};
export type SelectedState<TItem> =
  | SelectedBlurred<TItem>
  | SelectedFocusedClosed<TItem>
  | SelectedFocusedOpened<TItem>
  | SelectedFocusedOpenedHighlighted<TItem>;

/**
 * @category Selectors
 * @description
 * Utility function to determine if in unselected state
 */
export const isUnselected = <TItem>(
  model: ModelState<TItem>
): model is UnselectedState<TItem> => {
  return (
    model.type === "selected__focused__opened" ||
    model.type === "selected__focused__opened__highlighted" ||
    model.type === "selected__blurred" ||
    model.type === "selected__focused__closed"
  );
};
export type UnselectedState<TItem> = Exclude<
  ModelState<TItem>,
  SelectedState<TItem>
>;

/**
 * @category Selectors
 * @description
 * Utility function to determine if the dropdown is opened.
 */
export const isOpened = <TItem>(
  model: ModelState<TItem>
): model is OpenedState<TItem> => {
  return (
    model.type === "selected__focused__opened" ||
    model.type === "selected__focused__opened__highlighted" ||
    model.type === "unselected__focused__opened" ||
    model.type === "unselected__focused__opened__highlighted"
  );
};
export type OpenedState<TItem> =
  | UnselectedFocusedOpened
  | UnselectedFocusedOpenedHighlighted
  | SelectedFocusedOpened<TItem>
  | SelectedFocusedOpenedHighlighted<TItem>;

/**
 * @category Selectors
 * @description
 * Utility function to determine if the dropdown is closed.
 */
export const isClosed = <TItem>(
  model: ModelState<TItem>
): model is ClosedState<TItem> => {
  return !isOpened(model);
};
export type ClosedState<TItem> = Exclude<ModelState<TItem>, OpenedState<TItem>>;

/**
 * @category Selectors
 * @description
 * Utility function to determine if any item is highlighted.
 */
export const isHighlighted = <TItem>(
  model: ModelState<TItem>
): model is HighlightedState<TItem> => {
  return (
    model.type === "selected__focused__opened__highlighted" ||
    model.type === "unselected__focused__opened__highlighted"
  );
};

export type HighlightedState<TItem> =
  | UnselectedFocusedOpenedHighlighted
  | SelectedFocusedOpenedHighlighted<TItem>;

/**
 * @category Selectors
 * @description
 * Utility function to determine if input is blurred.
 */
export const isBlurred = <TItem>(
  model: ModelState<TItem>
): model is UnselectedBlurred | SelectedBlurred<TItem> => {
  return (
    model.type === "unselected__blurred" || model.type === "selected__blurred"
  );
};
export type BlurredState<TItem> = UnselectedBlurred | SelectedBlurred<TItem>;

/**
 * @category Selectors
 * @description
 * Utility function to determine if input is focused.
 */
export const isFocused = <TItem>(
  model: ModelState<TItem>
): model is FocusedState<TItem> => {
  return !isBlurred(model);
};
export type FocusedState<TItem> = Exclude<
  ModelState<TItem>,
  BlurredState<TItem>
>;

/**
 * @category Selectors
 * @description
 * This function returns the value that the input element should have.
 */
export const toCurrentInputValue = <TItem>(
  { toItemInputValue }: Pick<Config<TItem>, "toItemInputValue">,
  model: Model<TItem>
) => {
  switch (model.type) {
    case "unselected__blurred": {
      return "";
    }

    case "selected__blurred": {
      return toItemInputValue(model.selected);
    }

    case "selected__focused__closed":
    case "selected__focused__opened":
    case "selected__focused__opened__highlighted":
    case "unselected__focused__closed":
    case "unselected__focused__opened":
    case "unselected__focused__opened__highlighted": {
      return model.inputValue;
    }
  }
};

/**
 * @category Selectors
 * @description
 * This function returns the highlighted item.
 */
export const toHighlightedItem = <TItem>(
  { deterministicFilter }: Pick<Config<TItem>, "deterministicFilter">,
  model: Model<TItem>
): TItem | null => {
  switch (model.type) {
    case "unselected__blurred":
    case "unselected__focused__closed":
    case "unselected__focused__opened":
    case "selected__blurred":
    case "selected__focused__opened":
    case "selected__focused__closed": {
      return null;
    }

    case "unselected__focused__opened__highlighted":
    case "selected__focused__opened__highlighted": {
      const item = deterministicFilter(model)[model.highlightIndex];

      return item ?? null;
    }
  }
};

/**
 * @category Selectors
 * @description
 * Utility function to determine if an item is highlighted.
 */
export const isItemHighlighted = <TItem>(
  config: Pick<Config<TItem>, "toItemId" | "deterministicFilter">,
  model: Model<TItem>,
  item: TItem
): boolean => {
  const highlightedItem = toHighlightedItem(config, model);
  return Boolean(
    highlightedItem &&
      config.toItemId(highlightedItem) === config.toItemId(item)
  );
};

/**
 * @category Selectors
 * @description
 * This function returns the selected item
 */
export const toSelectedItem = <TItem>(model: Model<TItem>): TItem | null => {
  switch (model.type) {
    case "selected__blurred":
    case "selected__focused__opened":
    case "selected__focused__closed":
    case "selected__focused__opened__highlighted":
      return model.selected;

    case "unselected__blurred":
    case "unselected__focused__closed":
    case "unselected__focused__opened":
    case "unselected__focused__opened__highlighted":
      return null;
  }
};

/**
 * @category Selectors
 * @description
 * Utility function to determine if an item is selected.
 */
export const isItemSelected = <TItem>(
  { toItemId }: Pick<Config<TItem>, "toItemId">,
  model: Model<TItem>,
  item: TItem
) => {
  switch (model.type) {
    case "selected__blurred":
    case "selected__focused__opened":
    case "selected__focused__closed":
    case "selected__focused__opened__highlighted": {
      return toItemId(model.selected) === toItemId(item);
    }

    case "unselected__blurred":
    case "unselected__focused__closed":
    case "unselected__focused__opened":
    case "unselected__focused__opened__highlighted": {
      return false;
    }
  }
};

/**
 * @category Selectors
 * @description
 * Selector function to determine if an index is selected.
 */
export const isIndexHighlighted = <TItem>(
  model: Model<TItem>,
  index: number
): boolean => {
  switch (model.type) {
    case "unselected__blurred":
    case "unselected__focused__closed":
    case "unselected__focused__opened":
    case "selected__blurred":
    case "selected__focused__opened":
    case "selected__focused__closed": {
      return false;
    }

    case "unselected__focused__opened__highlighted":
    case "selected__focused__opened__highlighted": {
      return model.highlightIndex === index;
    }
  }
};

/**
 * @category Selectors
 * @description
 * Selector function to determine if an item is selected and highlighted.
 */
export const isItemSelectedAndHighlighted = <TItem>(
  config: Pick<Config<TItem>, "toItemId" | "deterministicFilter">,
  model: Model<TItem>,
  item: TItem
): boolean => {
  return (
    isItemSelected(config, model, item) &&
    isItemHighlighted(config, model, item)
  );
};

/**
 * @category Selectors
 * @description
 * This type represents all the possible states of an item
 */
export type ItemStatus =
  | "selected-and-highlighted"
  | "selected"
  | "highlighted"
  | "unselected";

/**
 * @category Selectors
 * @description
 * This utility function returns the status of an item.
 */
export const toItemStatus = <TItem>(
  config: Pick<Config<TItem>, "toItemId" | "deterministicFilter">,
  model: Model<TItem>,
  item: TItem
): ItemStatus => {
  if (isItemSelectedAndHighlighted(config, model, item)) {
    return "selected-and-highlighted";
  }

  if (isItemSelected(config, model, item)) {
    return "selected";
  }

  if (isItemHighlighted(config, model, item)) {
    return "highlighted";
  }

  return "unselected";
};

/**
 * @category Selectors
 * @description
 * This function returns the all the visible items.
 * This function really isn't necessary, but it's here for a more consistent API.
 */
export const toVisibleItems = <T>(config: Config<T>, model: Model<T>): T[] => {
  return config.deterministicFilter(model);
};

/**
 * @category Helpers
 * @description
 * This helper function converts a keyboard event key property to a message.
 **/
export const browserKeyboardEventKeyToMsg = (key: string) => {
  const eq = (a: string, b: string) =>
    a.toLowerCase().trim() === b.toLowerCase().trim();

  if (eq(key, "ArrowDown")) {
    return {
      type: "pressed-arrow-key",
      key: "arrow-down",
    } satisfies Msg<unknown>;
  }

  if (eq(key, "ArrowUp")) {
    return {
      type: "pressed-arrow-key",
      key: "arrow-up",
    } satisfies Msg<unknown>;
  }

  if (eq(key, "Escape")) {
    return { type: "pressed-escape-key" } satisfies Msg<unknown>;
  }

  if (eq(key, "Enter")) {
    return { type: "pressed-enter-key" } satisfies Msg<unknown>;
  }

  return null;
};

/**
 * @category WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the all html elements.
 */
export const aria = <T>(config: Config<T>, model: Model<T>) => {
  return {
    inputLabel: ariaInputLabel(config),
    input: ariaInput(config, model),
    helperText: ariaHelperText(config),
    itemList: ariaItemList(config),
    item: (item: T) => ariaItem(config, model, item),
  };
};

/**
 * @category WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for html that describes the <input />.
 */
const ariaHelperText = <T>(config: Config<T>) => {
  return {
    id: helperTextHtmlId(config),
  };
};

/**
 * @category WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the <label />.
 */
export const ariaInputLabel = <T>(config: Config<T>) => {
  return {
    id: inputLabelHtmlId(config),
    htmlFor: inputHtmlId(config),
  };
};

/**
 * @category WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the <input />.
 */
export const ariaInput = <T>(config: Config<T>, model: Model<T>) => {
  const highlightedItem = toHighlightedItem(config, model);
  return {
    id: inputHtmlId(config),
    role: "combobox",
    tabindex: 0,
    autoComplete: "off",
    "aria-controls": itemListHtmlId(config),
    "aria-haspopup": "listbox",
    "aria-expanded": isOpened(model) ? "true" : "false",
    "aria-describedby": helperTextHtmlId(config),
    ...(highlightedItem
      ? {
          "aria-activedescendant": itemHtmlId(config, highlightedItem),
        }
      : {}),
  } as const;
};

/**
 * @category WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the "suggestion list" <ul />.
 */
export const ariaItemList = <T>(config: Config<T>) => {
  return {
    id: itemListHtmlId(config),
    role: "listbox",
    "aria-labelledby": inputLabelHtmlId(config),
  } as const;
};

/**
 * @category WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the "option" <li />.
 */
export const ariaItem = <T>(config: Config<T>, model: Model<T>, item: T) => {
  const selected = toSelectedItem(model);
  return {
    id: itemHtmlId(config, item),
    role: "option",
    ...(selected
      ? {
          "aria-selected": config.toItemId(item) === config.toItemId(selected),
        }
      : {}),
  } as const;
};

/**
 * @category WAI-ARIA
 */
const inputLabelHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-input-label`;
};

/**
 * @category WAI-ARIA
 */
const inputHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-input`;
};

/**
 * @category WAI-ARIA
 */
const itemListHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-item-list`;
};

/**
 * @category WAI-ARIA
 */
const itemHtmlId = <T>({ toItemId, namespace }: Config<T>, item: T) => {
  return `${namespace}-item-${toItemId(item)}`;
};

/**
 * @category WAI-ARIA
 */
const helperTextHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-helper-text`;
};

/**
 * @category debug
 * @description
 * This function logs the state of the model and the effects.
 **/
export const debug = <TItem>({
  log,
  input,
  output,
}: {
  log: (...args: unknown[]) => void;
  input: {
    model: Model<TItem>;
    msg: Msg<TItem>;
  };
  output: {
    model: Model<TItem>;
    effects: Effect<TItem>[];
  };
}) => {
  log("\n");
  log("PREV ", input.model.type);
  log("msg: ", input.msg.type);
  log("NEXT ", output.model.type);
  if (output.model.skipOnce.length > 0) {
    log("skips: ", output.model.skipOnce.join(", "));
  }
  if (output.effects.length > 0) {
    log("effects: ", output.effects.map((eff) => eff.type).join(", "));
  }
  log("\n");
};

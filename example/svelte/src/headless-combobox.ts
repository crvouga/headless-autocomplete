/** @module Config **/

type Mode = "select-only" | "searchable";

/**
 * @memberof Config
 * @description
 * The Config<TItem> represents the configuration needed for the combobox to work with generic items.
 * @remark
 * ⚠️ All these functions should be deterministic!
 */
export type Config<TItem> = {
  mode: Mode;
  toItemId: (item: TItem) => string | number;
  toItemInputValue: (item: TItem) => string;
  deterministicFilter: (model: Model<TItem>) => TItem[];
  namespace: string;
};

/**
 * @memberof Config
 */
export const initConfig = <TItem>({
  namespace,
  mode,
  ...config
}: {
  toItemId: (item: TItem) => string | number;
  toItemInputValue: (item: TItem) => string;
  mode?: Mode;
  deterministicFilter?: (model: Model<TItem>) => TItem[];
  namespace?: string;
}): Config<TItem> => {
  return {
    ...config,
    mode: mode ?? "searchable",
    namespace: namespace ?? "combobox",
    deterministicFilter: (model) => simpleFilter(config, model),
  };
};

/**
 * @memberof Config
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

/** @module Model **/

/**
 * @memberof Model
 * @description
 * The Model<TItem> represents the state of the combobox.
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
 * @memberof Model
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
 * @memberof Model
 * @description
 * The init function returns the initial state of the combobox.
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

/** @module Update **/

/**
 * @memberof Update
 * @description
 * The Msg<TItem> represents all the possible state transitions that can happen to the combobox.
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
 * @memberof Update
 * @description
 * The Effect<TItem> represents all the possible effects that can happen to the combobox.
 * You as the user of the library has to implement the side effects
 **/
export type Effect<TItem> = {
  type: "scroll-item-into-view";
  item: TItem;
};

/**
 * @memberof Update
 * @description
 * The update function is the main function.
 * The update function takes the current state of the combobox and a message and returns the new state of the
 * combobox and effects that need to be run.
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

const toFiltered = <TItem>(
  config: Config<TItem>,
  model: Model<TItem>
): TItem[] => {
  if (config.mode === "searchable") {
    return config.deterministicFilter(model);
  }
  return model.allItems;
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
    const filtered = toFiltered(config, next);

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
  config: Config<TItem>,
  {
    model,
    msg,
  }: {
    model: Model<TItem>;
    msg: Msg<TItem>;
  }
): Model<TItem> => {
  const { toItemInputValue, toItemId } = config;
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
          const filtered = toFiltered(config, model);

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
          const filtered = toFiltered(config, model);
          const delta = msg.key === "arrow-down" ? 1 : -1;
          const highlightIndex = circularIndex(
            model.highlightIndex + delta,
            filtered.length
          );
          return { ...model, highlightIndex };
        }

        case "pressed-enter-key": {
          const filtered = toFiltered(config, model);

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
          const filtered = toFiltered(config, model);
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
          const filtered = toFiltered(config, model);
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
          const filtered = toFiltered(config, model);

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

/** @module Selectors **/

/**
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
 * @description
 * This function returns the highlighted item.
 */
export const toHighlightedItem = <TItem>(
  config: Config<TItem>,
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
      const item = toFiltered(config, model)[model.highlightIndex];

      return item ?? null;
    }
  }
};

/**
 * @memberof Selectors
 * @description
 * Utility function to determine if an item is highlighted.
 */
export const isItemHighlighted = <T>(
  config: Config<T>,
  model: Model<T>,
  item: T
): boolean => {
  const highlightedItem = toHighlightedItem(config, model);
  return Boolean(
    highlightedItem &&
      config.toItemId(highlightedItem) === config.toItemId(item)
  );
};

/**
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
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
 * @memberof Selectors
 * @description
 * Selector function to determine if an item is selected and highlighted.
 */
export const isItemSelectedAndHighlighted = <TItem>(
  config: Config<TItem>,
  model: Model<TItem>,
  item: TItem
): boolean => {
  return (
    isItemSelected(config, model, item) &&
    isItemHighlighted(config, model, item)
  );
};

/**
 * @memberof Selectors
 * @description
 * This type represents all the possible states of an item
 */
export type ItemStatus =
  | "selected-and-highlighted"
  | "selected"
  | "highlighted"
  | "unselected";

/**
 * @memberof Selectors
 * @description
 * This utility function returns the status of an item.
 */
export const toItemStatus = <TItem>(
  config: Config<TItem>,
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
 * @memberof Selectors
 * @description
 * This function returns the all the visible items.
 */
export const toVisibleItems = <T>(config: Config<T>, model: Model<T>): T[] => {
  return toFiltered(config, model);
};

/** @module WAI-ARIA **/

/**
 * @memberof WAI-ARIA
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
 * @memberof WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for html that describes the <input />.
 */
const ariaHelperText = <T>(config: Config<T>) => {
  return {
    id: helperTextHtmlId(config),
  };
};

/**
 * @memberof WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the <label />.
 */
export const ariaInputLabel = <T>(config: Config<T>) => {
  return {
    id: inputLabelHtmlId(config),
    for: inputHtmlId(config),
    htmlFor: inputHtmlId(config),
  };
};

/**
 * @memberof WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the <input />.
 */
export const ariaInput = <T>(config: Config<T>, model: Model<T>) => {
  const highlightedItem = toHighlightedItem(config, model);
  return {
    id: inputHtmlId(config),
    role: "combobox",
    tabindex: 0,
    combobox: "off",
    "aria-autocomplete": "list",
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
 * @memberof WAI-ARIA
 * @description
 * This function returns WAI-ARIA attributes for the "suggestion list" <ul />.
 */
export const ariaItemList = <T>(config: Config<T>) => {
  return {
    id: itemListHtmlId(config),
    role: "listbox",
    "aria-labelledby": inputLabelHtmlId(config),
    tabindex: -1,
  } as const;
};

/**
 * @memberof WAI-ARIA
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
 * @memberof WAI-ARIA
 */
const inputLabelHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-input-label`;
};

/**
 * @memberof WAI-ARIA
 */
const inputHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-input`;
};

/**
 * @memberof WAI-ARIA
 */
const itemListHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-item-list`;
};

/**
 * @memberof WAI-ARIA
 */
const itemHtmlId = <T>({ toItemId, namespace }: Config<T>, item: T) => {
  return `${namespace}-item-${toItemId(item)}`;
};

/**
 * @memberof WAI-ARIA
 */
const helperTextHtmlId = <T>({ namespace }: Config<T>) => {
  return `${namespace}-helper-text`;
};

/** @module Helpers **/

/**
 * @memberof Helpers
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

const modelToState = <T>(config: Config<T>, model: Model<T>) => {
  return {
    allItems: model.allItems,
    items: toVisibleItems(config, model),
    isOpened: isOpened(model),
    highlightedItem: toHighlightedItem(config, model),
    isItemHighlighted: (item: T) => isItemHighlighted(config, model, item),
    isItemSelected: (item: T) => isItemSelected(config, model, item),
    inputValue: toCurrentInputValue(config, model),
    selectedItem: toSelectedItem(model),
    aria: aria(config, model),
    isBlurred: isBlurred(model),
    isFocused: isFocused(model),
    itemStatus: (item: T) => toItemStatus(config, model, item),
  } as const;
};

type State<T> = ReturnType<typeof modelToState<T>>;

export type comboboxState<T> = State<T>;

/**
 * @memberof Helpers
 * @description
 * This is a helper function that returns an object that can be glued into your app with less boilerplate.
 */
export const createCombobox = <T>({
  allItems,
  toItemId,
  toItemInputValue,
  onScroll,
  namespace,
  deterministicFilter,
  mode,
}: {
  allItems: T[];
  toItemId: (item: T) => string | number;
  toItemInputValue: (item: T) => string;
  onScroll: (item: T, config: Config<T>) => void;
  mode?: Mode;
  namespace?: string;
  deterministicFilter?: (model: Model<T>) => T[];
}) => {
  const config = initConfig({
    toItemId,
    toItemInputValue,
    namespace,
    deterministicFilter,
    mode,
  });

  const subscribers = new Map<string, (state: State<T>) => void>();

  let model = init({
    allItems,
  });

  const setModel = (newModel: Model<T>) => {
    model = newModel;
    for (const subscriber of subscribers.values()) {
      subscriber(modelToState(config, model));
    }
  };

  const getState = () => {
    return modelToState(config, model);
  };

  const dispatch = (msg: Msg<T>) => {
    const output = update(config, { model, msg });
    setModel(output.model);
    for (const effect of output.effects) {
      if (effect.type === "scroll-item-into-view") {
        onScroll(effect.item, config);
      }
    }
  };

  const subscribe = (subscriber: (state: State<T>) => void) => {
    const id = Math.random().toString(36).substring(2, 9);
    subscribers.set(id, subscriber);
    return () => {
      subscribers.delete(id);
    };
  };

  const events = {
    onInput: (inputValue: string) =>
      dispatch({ type: "inputted-value", inputValue }),
    onInputKeyDown: (key: string) => {
      const msg = browserKeyboardEventKeyToMsg(key);
      if (msg) {
        dispatch(msg);
      }
    },
    onInputBlur: () => dispatch({ type: "blurred-input" }),
    onInputFocus: () => dispatch({ type: "focused-input" }),
    onInputPress: () => dispatch({ type: "pressed-input" }),
    //
    onItemPress: (item: T) => dispatch({ type: "pressed-item", item }),
    onItemFocus: (index: number) =>
      dispatch({ type: "hovered-over-item", index }),
    onItemHover: (index: number) =>
      dispatch({ type: "hovered-over-item", index }),
  };

  const setAllItems = (allItems: T[]) => {
    setModel({
      ...model,
      allItems,
    });
  };

  return {
    ...config,
    ...events,
    setAllItems,
    getState,
    dispatch,
    subscribe,
  };
};

/** @module Debug **/

/**
 * @memberof Debug
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
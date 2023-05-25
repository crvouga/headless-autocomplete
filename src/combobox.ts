import { aria } from "./combobox-wai-aria";
import { isNonEmpty, type NonEmpty } from "./non-empty";
import { circularIndex, clampIndex, removeFirst } from "./utils";

/** @module Config **/

/**
 * @group Config
 *
 * The Config<TItem> represents the configuration needed for the combobox to work with generic items.
 * @remark
 * ⚠️ All these functions should be deterministic!
 */
export type Config<TItem> = {
  toItemId: (item: TItem) => string | number;
  toItemInputValue: (item: TItem) => string;
  deterministicFilter: (model: Model<TItem>) => TItem[];
  isEmptyItem: (value: TItem) => boolean;
  namespace: string;
};

/**
 * @group Config
 */
export const initConfig = <TItem>({
  namespace,
  isEmptyItem = () => false,
  ...config
}: {
  toItemId: (item: TItem) => string | number;
  toItemInputValue: (item: TItem) => string;
  isEmptyItem?: (item: TItem) => boolean;
  deterministicFilter?: (model: Model<TItem>) => TItem[];
  namespace?: string;
}): Config<TItem> => {
  const configFull: Config<TItem> = {
    ...config,
    isEmptyItem,
    namespace: namespace ?? "combobox",
    deterministicFilter: (model) => model.allItems,
  };
  return {
    ...configFull,
    deterministicFilter: (model) => simpleFilter(configFull, model),
  };
};

/**
 * @group Config
 *
 * The simpleFilter function is a default implementation of the deterministicFilter function.
 */
export const simpleFilter = <TItem>(
  config: Config<TItem>,
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
 * @group Model
 * The Model<TItem> represents the state of the combobox.
 * This is the data you will be saving in your app.
 */
export type Model<TItem> = ModelState & {
  allItems: TItem[];
  selectedItems: TItem[];
  skipOnce: Msg<TItem>["type"][];
  selectMode: SelectMode;
  inputMode: InputMode;
};

/**
 * @group Model
 *
 */
export type SelectMode =
  | {
      type: "single-select";
    }
  | {
      type: "multi-select";
      selectedItemListDirection: SelectedItemListDirection;
    };

export type SelectedItemListDirection = "left-to-right" | "right-to-left";

/**
 * @group Model
 *
 */
export type InputMode =
  | {
      type: "select-only";
    }
  | {
      type: "search-mode";
      inputValue: string;
    };

type Blurred = {
  type: "blurred";
};

type FocusedClosed = {
  type: "focused__closed";
};

type FocusedOpened = {
  type: "focused__opened";
};

type FocusedOpenedHighlighted = {
  type: "focused__opened__highlighted";
  highlightIndex: number;
};

type SelectedItemHighlighted = {
  type: "selected-item-highlighted";
  focusedIndex: number;
};

type ModelState =
  | Blurred
  | FocusedClosed
  | FocusedOpened
  | FocusedOpenedHighlighted
  | SelectedItemHighlighted;

/**
 * @group Model
 *
 * The init function returns the initial state of the combobox.
 */
export const init = <TItem>({
  allItems,
  selectMode,
  inputMode,
}: {
  allItems: TItem[];
  selectMode?: SelectMode;
  inputMode?: InputMode;
}): Model<TItem> => {
  return {
    type: "blurred",
    selectedItems: [],
    allItems,
    skipOnce: [],
    inputMode: inputMode ? inputMode : { type: "search-mode", inputValue: "" },
    selectMode: selectMode ? selectMode : { type: "single-select" },
  };
};

/** @module Update **/

/**
 * @group Update
 *
 * The Msg<TItem> represents all the possible state transitions that can happen to the combobox.
 */
export type Msg<TItem> =
  | {
      type: "pressed-horizontal-arrow-key";
      key: "arrow-left" | "arrow-right";
    }
  | {
      type: "pressed-vertical-arrow-key";
      key: "arrow-up" | "arrow-down";
    }
  | {
      type: "pressed-backspace-key";
    }
  | {
      type: "pressed-escape-key";
    }
  | {
      type: "pressed-enter-key";
    }
  | {
      type: "pressed-key";
      key: string;
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
    }
  | {
      type: "pressed-unselect-all-button";
    }
  | {
      type: "pressed-unselect-button";
      item: TItem;
    }
  | {
      type: "focused-selected-item";
      item: TItem;
    }
  | {
      type: "blurred-selected-item";
      item: TItem;
    }
  //
  // Setters
  //
  | {
      type: "set-all-items";
      allItems: TItem[];
    }
  | {
      type: "set-selected-items";
      selectedItems: TItem[];
    }
  | {
      type: "set-input-value";
      inputValue: string;
    }
  | {
      type: "set-highlight-index";
      highlightIndex: number;
    }
  | {
      type: "set-mode";
      mode: SelectMode;
    };

/**
 * @group Update
 *
 * The Effect<TItem> represents all the possible effects that can happen to the combobox.
 * You as the user of the library has to implement the side effects
 **/
export type Effect<TItem> =
  | {
      type: "scroll-item-into-view";
      item: TItem;
    }
  | {
      type: "focus-selected-item";
      item: TItem;
    }
  | {
      type: "focus-input";
    };

/**
 * @group Update
 *
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
  /**
   *
   *
   *
   */
  if (model.skipOnce.includes(msg.type)) {
    return {
      model: {
        ...model,
        skipOnce: removeFirst((m) => m === msg.type, model.skipOnce),
      },
      effects: [],
    };
  }

  /**
   *
   *
   *
   */

  let output: {
    model: Model<TItem>;
    effects: Effect<TItem>[];
  } = {
    model,
    effects: [],
  };

  /**
   *
   * Update Model
   *
   */

  output.model = updateSetters({
    msg,
    model: updateModel(config, { msg, model }),
  });

  /**
   *
   * Add Effects
   *
   */

  // scroll to selected item into view when state changes from closed to opened
  if (isClosed(model) && isOpened(output.model) && isSelected(output.model)) {
    output.effects.push({
      type: "scroll-item-into-view",
      item: output.model.selectedItems[0],
    });
  }

  // focus on input when user presses it
  if (msg.type === "pressed-input") {
    output.effects.push({
      type: "focus-input",
    });
  }

  // scroll highlighted item into view when navigating with keyboard
  if (
    isHighlighted(output.model) &&
    msg.type === "pressed-vertical-arrow-key"
  ) {
    const visible = toVisibleItems(config, output.model);

    const highlightedItem = visible[output.model.highlightIndex];

    if (highlightedItem) {
      output.effects.push({
        type: "scroll-item-into-view",
        item: highlightedItem,
      });
    }
  }

  // focus on selected item when highlighted
  if (isSelectedItemHighlighted(output.model)) {
    const selectedHighlightedItem =
      output.model.selectedItems[output.model.focusedIndex];
    if (selectedHighlightedItem) {
      output.effects.push({
        type: "focus-selected-item",
        item: selectedHighlightedItem,
      });
    }
  }

  // focus on input when navigating selected items with keyboard
  if (
    isSelectedItemHighlighted(model) &&
    !isSelectedItemHighlighted(output.model)
  ) {
    output.effects.push({
      type: "focus-input",
    });
  }

  // focus on input after clearing selectedItems
  if (msg.type === "pressed-unselect-all-button") {
    output.effects.push({
      type: "focus-input",
    });
  }

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
    isOpened(output.model) &&
    output.effects.some((effect) => effect.type === "scroll-item-into-view")
  ) {
    output.model = {
      ...output.model,
      skipOnce: ["hovered-over-item", "hovered-over-item"],
    };
  }

  if (isClosed(model) && isOpened(output.model)) {
    output.model = {
      ...output.model,
      skipOnce: [...output.model.skipOnce, "hovered-over-item"],
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
  if (
    output.effects.some((effect) => effect.type === "scroll-item-into-view")
  ) {
    output.model = { ...output.model, skipOnce: ["hovered-over-item"] };
  }

  /**

   ⚠️ Edge case

   ⏱ Happens when:
   Pressing input when the input is blurred

   🤔 Expected Behavior:
   The the suggestion drop down opens

   😑 Actual Behavior:
   Two events fire. input focused then input pressed. This causes the suggestion drop down to open and then close.

   */
  if (
    (isBlurred(model) || model.type === "selected-item-highlighted") &&
    isFocused(output.model)
  ) {
    output.model = {
      ...output.model,
      skipOnce: [...output.model.skipOnce, "pressed-input"],
    };
  }

  return output;
};

const updateSetters = <TItem>({
  model,
  msg,
}: {
  model: Model<TItem>;
  msg: Msg<TItem>;
}): Model<TItem> => {
  if (msg.type === "set-all-items") {
    return {
      ...model,
      allItems: msg.allItems,
    };
  }

  if (msg.type === "set-selected-items") {
    if (isSelected(model)) {
      return {
        ...model,
        selectedItems: msg.selectedItems,
      };
    }
    return {
      ...model,
      type: "blurred",
      selectedItems: msg.selectedItems,
    };
  }

  if (msg.type === "set-input-value") {
    if (model.inputMode.type === "search-mode") {
      return {
        ...model,
        inputMode: {
          type: "search-mode",
          inputValue: msg.inputValue,
        },
      };
    }
    return model;
  }

  if (msg.type === "set-highlight-index") {
    if (isHighlighted(model)) {
      return {
        ...model,
        highlightIndex: msg.highlightIndex,
      };
    }
    return model;
  }

  if (msg.type === "set-mode") {
    return {
      ...model,
      selectMode: msg.mode,
    };
  }

  return model;
};

const updateModel = <T>(
  config: Config<T>,
  {
    model,
    msg,
  }: {
    model: Model<T>;
    msg: Msg<T>;
  }
): Model<T> => {
  const { toItemId } = config;
  switch (model.type) {
    case "blurred": {
      switch (msg.type) {
        case "focused-input": {
          return resetInputValue(config, {
            ...model,
            type: "focused__opened",
            selectedItems: model.selectedItems,
          });
        }

        case "pressed-unselect-all-button": {
          return {
            ...model,
            type: "blurred",
          };
        }

        case "pressed-unselect-button": {
          const removed = model.selectedItems.filter(
            (x) => toItemId(x) !== toItemId(msg.item)
          );
          if (isNonEmpty(removed)) {
            return { ...model, selectedItems: removed };
          }
          return { ...model, type: "blurred" };
        }

        case "focused-selected-item": {
          return {
            ...model,
            type: "selected-item-highlighted",
            focusedIndex: model.selectedItems.findIndex(
              (item) => toItemId(item) === toItemId(msg.item)
            ),
          };
        }

        default: {
          return model;
        }
      }
    }

    case "focused__closed": {
      switch (msg.type) {
        case "pressed-input": {
          return { ...model, type: "focused__opened" };
        }

        case "blurred-input": {
          return { ...model, type: "blurred" };
        }

        case "inputted-value": {
          if (model.inputMode.type === "select-only") {
            return resetInputValue(config, {
              ...model,
              type: "focused__opened",
            });
          }
          if (
            msg.inputValue === "" &&
            model.selectMode.type === "single-select"
          ) {
            return setInputValue(
              {
                ...model,
                type: "focused__opened",
              },
              msg.inputValue
            );
          }
          return setInputValue(
            {
              ...model,
              type: "focused__opened",
            },
            msg.inputValue
          );
        }

        case "pressed-enter-key": {
          return resetInputValue(config, {
            ...model,
            type: "focused__opened",
          });
        }

        case "pressed-vertical-arrow-key": {
          if (model.selectMode.type === "single-select") {
            return resetInputValue(config, {
              ...model,
              type: "focused__opened",
            });
          }

          const selectedItemIndex = toSelectedItemIndex(config, model);

          return resetInputValue(config, {
            ...model,
            highlightIndex: selectedItemIndex ? selectedItemIndex : 0,
            type: "focused__opened__highlighted",
          });
        }

        case "pressed-horizontal-arrow-key": {
          return updateKeyboardNavigationForSelections({ model, msg });
        }

        case "pressed-unselect-button": {
          const removed = model.selectedItems.filter(
            (x) => toItemId(x) !== toItemId(msg.item)
          );
          if (isNonEmpty(removed)) {
            return { ...model, selectedItems: removed };
          }
          return { ...model, type: "focused__closed" };
        }

        case "focused-selected-item": {
          return {
            ...model,
            type: "selected-item-highlighted",
            focusedIndex: model.selectedItems.findIndex(
              (item) => toItemId(item) === toItemId(msg.item)
            ),
          };
        }

        case "pressed-backspace-key": {
          if (
            model.inputMode.type === "select-only" &&
            model.selectMode.type === "single-select"
          ) {
            return { ...model, type: "focused__opened", selectedItems: [] };
          }

          if (
            model.inputMode.type === "search-mode" &&
            model.inputMode.inputValue === ""
          ) {
            const removed = model.selectedItems.slice(1);
            if (isNonEmpty(removed)) {
              return { ...model, selectedItems: removed };
            }
            return { ...model, type: "focused__opened" };
          }

          return model;
        }

        case "pressed-unselect-all-button": {
          return {
            ...model,
            type: "focused__closed",
          };
        }

        default: {
          return model;
        }
      }
    }

    case "focused__opened": {
      switch (msg.type) {
        case "hovered-over-item": {
          return {
            ...model,
            type: "focused__opened__highlighted",
            highlightIndex: msg.index,
          };
        }

        case "blurred-input": {
          return {
            ...model,
            type: "blurred",
            selectedItems: model.selectedItems,
          };
        }

        case "pressed-input": {
          return {
            ...model,
            type: "focused__closed",
          };
        }

        case "pressed-item": {
          const pressedItem = msg.item;

          if (config.isEmptyItem(pressedItem)) {
            return {
              ...model,
              type: "focused__closed",
            };
          }

          const modelNew = toggleSelected({
            config,
            item: pressedItem,
            model,
          });

          return {
            ...modelNew,
            // inputValue: modelToInputValue(config, modelNew),
          };
        }

        case "inputted-value": {
          if (model.inputMode.type === "select-only") {
            return resetInputValue(config, {
              ...model,
              type: "focused__opened",
            });
          }

          if (
            msg.inputValue === "" &&
            model.selectMode.type === "single-select"
          ) {
            return clearInputValue({
              ...model,
              selectedItems: [],
              type: "focused__opened",
            });
          }

          return setInputValue(model, msg.inputValue);
        }

        case "pressed-enter-key": {
          return resetInputValue(config, {
            ...model,
            type: "focused__closed",
          });
        }

        case "pressed-vertical-arrow-key": {
          const visible = toVisibleItems(config, model);

          const selectedIndex = visible.findIndex((item) =>
            model.selectedItems.some((x) => toItemId(item) === toItemId(x))
          );

          if (selectedIndex === -1) {
            return {
              ...model,
              highlightIndex: 0,
              type: "focused__opened__highlighted",
            };
          }

          const delta = msg.key === "arrow-down" ? 1 : -1;

          const highlightIndex = circularIndex(
            selectedIndex + delta,
            visible.length
          );

          return {
            ...model,
            highlightIndex,
            type: "focused__opened__highlighted",
          };
        }

        case "pressed-escape-key": {
          return {
            ...model,
            type: "focused__closed",
          };
        }

        case "pressed-horizontal-arrow-key": {
          return updateKeyboardNavigationForSelections({ model, msg });
        }

        case "pressed-unselect-button": {
          const removed = model.selectedItems.filter(
            (x) => toItemId(x) !== toItemId(msg.item)
          );
          if (isNonEmpty(removed)) {
            return { ...model, selectedItems: removed };
          }
          return { ...model, type: "focused__opened" };
        }

        case "pressed-backspace-key": {
          if (
            model.inputMode.type === "select-only" &&
            model.selectMode.type === "single-select"
          ) {
            return { ...model, selectedItems: [] };
          }

          if (toSearchValue(model) === "") {
            return {
              ...model,
              selectedItems: model.selectedItems.slice(1),
            };
          }
          return model;
        }

        case "pressed-unselect-all-button": {
          return {
            ...model,
            type: "focused__opened",
          };
        }

        default: {
          return model;
        }
      }
    }

    case "focused__opened__highlighted": {
      switch (msg.type) {
        case "hovered-over-item": {
          return { ...model, highlightIndex: msg.index };
        }

        case "blurred-input": {
          return { ...model, type: "blurred" };
        }

        case "pressed-item": {
          const pressedItem = msg.item;

          if (config.isEmptyItem(pressedItem)) {
            return {
              ...model,
              type: "focused__closed",
            };
          }

          if (model.selectMode.type === "single-select") {
            const modelNew: Model<T> = {
              ...model,
              type: "focused__closed",
              selectedItems: addSelected(
                model.selectMode,
                pressedItem,
                model.selectedItems
              ),
            };
            return resetInputValue(config, modelNew);
          }

          if (!isItemSelected(config, model, pressedItem)) {
            const modelNew: Model<T> = {
              ...model,
              type: "focused__closed",
              selectedItems: addSelected(
                model.selectMode,
                pressedItem,
                model.selectedItems
              ),
            };

            return resetInputValue(config, modelNew);
          }

          const removed = model.selectedItems.filter(
            (x) => toItemId(x) !== toItemId(pressedItem)
          );

          if (isNonEmpty(removed)) {
            return {
              ...model,
              type: "focused__closed",
              selectedItems: removed,
            };
          }

          return {
            ...model,
            type: "focused__closed",
          };
        }

        case "inputted-value": {
          if (model.inputMode.type === "select-only") {
            return resetInputValue(config, {
              ...model,
              type: "focused__opened",
            });
          }
          if (
            msg.inputValue === "" &&
            model.selectMode.type === "single-select"
          ) {
            return clearInputValue({
              ...model,
              selectedItems: [],
              type: "focused__opened",
            });
          }
          return setInputValue(model, msg.inputValue);
        }

        case "pressed-vertical-arrow-key": {
          const visible = toVisibleItems(config, model);
          const delta = msg.key === "arrow-down" ? 1 : -1;
          const highlightIndex = circularIndex(
            model.highlightIndex + delta,
            visible.length
          );
          return { ...model, highlightIndex: highlightIndex };
        }

        case "pressed-horizontal-arrow-key": {
          return updateKeyboardNavigationForSelections({ model, msg });
        }

        case "pressed-enter-key": {
          const visible = toVisibleItems(config, model);

          const enteredItem = visible[model.highlightIndex];

          if (!enteredItem) {
            return { ...model, type: "focused__closed" };
          }

          if (config.isEmptyItem(enteredItem)) {
            return {
              ...model,
              type: "focused__closed",
            };
          }

          if (model.selectMode.type === "single-select") {
            const modelNew: Model<T> = {
              ...model,
              selectedItems: addSelected(
                model.selectMode,
                enteredItem,
                model.selectedItems
              ),
              type: "focused__closed",
            };
            return resetInputValue(config, modelNew);
          }

          if (!isItemSelected(config, model, enteredItem)) {
            return clearInputValue({
              ...model,
              selectedItems: addSelected(
                model.selectMode,
                enteredItem,
                model.selectedItems
              ),
              type: "focused__closed",
            });
          }

          const removed = model.selectedItems.filter(
            (x) => toItemId(x) !== toItemId(enteredItem)
          );

          if (isNonEmpty(removed)) {
            return clearInputValue({
              ...model,
              selectedItems: removed,
              type: "focused__closed",
            });
          }

          return clearInputValue({
            ...model,
            type: "focused__closed",
          });
        }

        case "pressed-escape-key": {
          return { ...model, type: "focused__closed" };
        }

        case "pressed-unselect-button": {
          const removed = model.selectedItems.filter(
            (x) => toItemId(x) !== toItemId(msg.item)
          );
          if (isNonEmpty(removed)) {
            return { ...model, selectedItems: removed };
          }
          return { ...model, type: "focused__opened__highlighted" };
        }

        case "focused-selected-item": {
          return {
            ...model,
            type: "selected-item-highlighted",
            focusedIndex: model.selectedItems.findIndex(
              (item) => toItemId(item) === toItemId(msg.item)
            ),
          };
        }

        case "pressed-backspace-key": {
          if (toSearchValue(model) === "") {
            const removed = model.selectedItems.slice(1);
            if (isNonEmpty(removed)) {
              return { ...model, selectedItems: removed };
            }
            return { ...model, type: "focused__opened" };
          }
          return model;
        }

        case "pressed-unselect-all-button": {
          return {
            ...model,
            type: "focused__opened",
          };
        }

        default: {
          return model;
        }
      }
    }

    case "selected-item-highlighted": {
      switch (msg.type) {
        case "pressed-horizontal-arrow-key": {
          if (model.selectMode.type !== "multi-select") {
            return clearInputValue({
              ...model,
              type: "focused__closed",
            });
          }

          if (
            model.focusedIndex === 0 &&
            model.selectMode.selectedItemListDirection === "right-to-left" &&
            msg.key === "arrow-right"
          ) {
            return clearInputValue({
              ...model,
              type: "focused__closed",
            });
          }

          if (
            model.focusedIndex === 0 &&
            model.selectMode.selectedItemListDirection === "left-to-right" &&
            msg.key === "arrow-left"
          ) {
            return clearInputValue({
              ...model,
              type: "focused__closed",
            });
          }

          const delta =
            model.selectMode.selectedItemListDirection === "right-to-left"
              ? msg.key === "arrow-right"
                ? -1
                : 1
              : model.selectMode.selectedItemListDirection === "left-to-right"
              ? msg.key === "arrow-left"
                ? -1
                : 1
              : 0;

          const selectedItemHighlightIndexNew = clampIndex(
            model.focusedIndex + delta,
            model.selectedItems.length
          );
          return {
            ...model,
            focusedIndex: selectedItemHighlightIndexNew,
          };
        }

        case "pressed-vertical-arrow-key": {
          if (model.selectMode.type === "single-select") {
            return resetInputValue(config, {
              ...model,
              type: "focused__opened",
            });
          }

          const selectedItemIndex = toSelectedItemIndex(config, model);

          return resetInputValue(config, {
            ...model,
            highlightIndex: selectedItemIndex ? selectedItemIndex : 0,
            type: "focused__opened__highlighted",
          });
        }

        case "inputted-value": {
          if (model.inputMode.type === "select-only") {
            return setInputValue(
              {
                ...model,

                type: "focused__opened",
              },
              modelToInputValue(config, model)
            );
          }
          if (toSearchValue(model) === "") {
            return setInputValue(
              {
                ...model,

                selectedItems: [],
                type: "focused__opened",
              },
              msg.inputValue
            );
          }
          return setInputValue(
            {
              ...model,

              type: "focused__opened",
            },
            msg.inputValue
          );
        }

        case "pressed-key":
        case "pressed-enter-key":
        case "pressed-escape-key": {
          return clearInputValue({
            ...model,
            type: "focused__closed",
          });
        }

        case "pressed-backspace-key": {
          const removedHighlightedIndex = model.selectedItems.filter(
            (_, index) => index !== model.focusedIndex
          );

          return clearInputValue({
            ...model,
            selectedItems: removedHighlightedIndex,
            type: "focused__closed",
          });
        }

        case "pressed-unselect-button": {
          const removed = model.selectedItems.filter(
            (x) => toItemId(x) !== toItemId(msg.item)
          );
          if (isNonEmpty(removed)) {
            const selectedItemHighlightIndex = clampIndex(
              model.focusedIndex,
              removed.length
            );
            return {
              ...model,
              selectedItems: removed,
              focusedIndex: selectedItemHighlightIndex,
            };
          }
          return clearInputValue({
            ...model,
            type: "focused__closed",
          });
        }

        case "focused-selected-item": {
          return {
            ...model,
            type: "selected-item-highlighted",
            focusedIndex: model.selectedItems.findIndex(
              (item) => toItemId(item) === toItemId(msg.item)
            ),
          };
        }

        case "blurred-selected-item": {
          return model;
        }

        case "focused-input": {
          return clearInputValue({
            ...model,
            type: "focused__opened",
          });
        }

        case "pressed-unselect-all-button": {
          return clearInputValue({
            ...model,
            type: "focused__opened",
          });
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

const toggleSelected = <T>({
  config,
  model,
  item,
}: {
  config: Config<T>;
  model: Model<T>;
  item: T;
}): Model<T> => {
  if (!isSelected(model)) {
    return model;
  }

  if (model.selectMode.type === "single-select") {
    const modelNew: Model<T> = {
      ...model,
      type: "focused__closed",
      selectedItems: addSelected(model.selectMode, item, model.selectedItems),
    };
    return setInputValue(modelNew, modelToInputValue(config, modelNew));
  }

  if (!isItemSelected(config, model, item)) {
    const modelNew: Model<T> = {
      ...model,
      type: "focused__closed",
      selectedItems: addSelected(model.selectMode, item, model.selectedItems),
    };
    return setInputValue(modelNew, modelToInputValue(config, modelNew));
  }

  const removed = model.selectedItems.filter(
    (x) => config.toItemId(x) !== config.toItemId(item)
  );

  if (isNonEmpty(removed)) {
    return setInputValue(
      {
        ...model,

        type: "focused__closed",
        selectedItems: removed,
      },
      modelToInputValue(config, model)
    );
  }

  return setInputValue(
    {
      ...model,

      type: "focused__closed",
    },
    modelToInputValue(config, model)
  );
};

const toSelectedItemIndex = <T>(
  config: Config<T>,
  model: Model<T>
): number | null => {
  const selectedIndex = toVisibleItems(config, model).findIndex((item) =>
    model.selectedItems.some(
      (x) => config.toItemId(item) === config.toItemId(x)
    )
  );
  return selectedIndex === -1 ? null : selectedIndex;
};

const setInputValue = <T>(model: Model<T>, inputValue: string): Model<T> => {
  if (model.inputMode.type === "search-mode") {
    return {
      ...model,
      inputMode: {
        type: "search-mode",
        inputValue: inputValue,
      },
    };
  }
  return model;
};

const clearInputValue = <T>(model: Model<T>): Model<T> => {
  return setInputValue(model, "");
};

const toSearchValue = <T>(model: Model<T>): string => {
  return model.inputMode.type === "search-mode"
    ? model.inputMode.inputValue
    : "";
};

const addSelected = <TItem>(
  mode: SelectMode,
  item: TItem,
  selectedItems: TItem[]
): NonEmpty<TItem> => {
  if (mode.type === "single-select") {
    return [item];
  }
  const selectedItemsNew = [...selectedItems, item];
  if (isNonEmpty(selectedItemsNew)) {
    return selectedItemsNew;
  }
  return [item];
};

const updateKeyboardNavigationForSelections = <T>({
  model,
  msg,
}: {
  model: Model<T> & FocusedState;
  msg: Msg<T>;
}): Model<T> => {
  if (!isSelected(model)) {
    return model;
  }

  if (msg.type !== "pressed-horizontal-arrow-key") {
    return model;
  }

  if (model.selectMode.type !== "multi-select") {
    return model;
  }

  if ("inputValue" in model && toSearchValue(model) !== "") {
    return model;
  }

  if (
    model.selectMode.selectedItemListDirection === "right-to-left" &&
    msg.key === "arrow-left"
  ) {
    return {
      ...model,
      type: "selected-item-highlighted",
      focusedIndex: 0,
    };
  }

  if (
    model.selectMode.selectedItemListDirection === "left-to-right" &&
    msg.key === "arrow-right"
  ) {
    return {
      ...model,
      type: "selected-item-highlighted",
      focusedIndex: 0,
    };
  }

  return model;
};

export const resetInputValue = <T>(
  config: Config<T>,
  model: Model<T>
): Model<T> => {
  return setInputValue(model, modelToInputValue(config, model));
};

const modelToInputValue = <T>(config: Config<T>, model: Model<T>): string => {
  if (
    model.inputMode.type === "select-only" &&
    model.selectMode.type === "multi-select"
  ) {
    return "";
  }

  if (model.inputMode.type === "select-only") {
    const emptyItem = model.allItems.find((item) => config.isEmptyItem(item));
    if (isSelected(model)) {
      return config.toItemInputValue(model.selectedItems[0]);
    }
    if (isHighlighted(model)) {
      const item = model.allItems[model.highlightIndex];

      if (!item) {
        return emptyItem ? config.toItemInputValue(emptyItem) : "";
      }

      return config.toItemInputValue(item);
    }

    return emptyItem ? config.toItemInputValue(emptyItem) : "";
  }

  if (isSelected(model) && model.selectMode.type === "single-select") {
    return config.toItemInputValue(model.selectedItems[0]);
  }

  return "";
};

/** @module Selectors **/

/**
 * @group Selectors
 *
 * Utility function to determine if any item is selected.
 */
export const isSelected = <TItem>(
  model: Model<TItem>
): model is SelectedState<TItem> => {
  return isNonEmpty(model.selectedItems);
};
export type SelectedState<T> = Model<T> & { selectedItems: NonEmpty<T> };

/**
 * @group Selectors
 *
 * Utility function to determine if in unselected state
 */
export const isUnselected = <TItem>(
  model: ModelState
): model is UnselectedState<TItem> => {
  return (
    model.type === "focused__opened" ||
    model.type === "focused__opened__highlighted" ||
    model.type === "blurred" ||
    model.type === "focused__closed"
  );
};
export type UnselectedState<TItem> = Exclude<ModelState, SelectedState<TItem>>;

/**
 * @group Selectors
 *
 * Utility function to determine if the dropdown is opened.
 */
export const isOpened = (model: ModelState): model is OpenedState => {
  return (
    model.type === "focused__opened" ||
    model.type === "focused__opened__highlighted"
  );
};
export type OpenedState = FocusedOpened | FocusedOpenedHighlighted;

/**
 * @group Selectors
 *
 * Utility function to determine if the dropdown is closed.
 */
export const isClosed = (model: ModelState): model is ClosedState => {
  return !isOpened(model);
};
export type ClosedState = Exclude<ModelState, OpenedState>;

/**
 * @group Selectors
 *
 * Utility function to determine if any item is highlighted.
 */
export const isHighlighted = (
  model: ModelState
): model is FocusedOpenedHighlighted => {
  return model.type === "focused__opened__highlighted";
};

/**
 * @group Selectors
 *
 * Utility function to determine if input is blurred.
 */
export const isBlurred = (model: ModelState): model is Blurred => {
  return model.type === "blurred";
};

/**
 * @group Selectors
 *
 */
export const isSelectedItemHighlighted = (
  model: ModelState
): model is SelectedItemHighlighted => {
  return model.type === "selected-item-highlighted";
};

/**
 * @group Selectors
 *
 * Utility function to determine if input is focused.
 */
export const isFocused = (model: ModelState): model is FocusedState => {
  return !isBlurred(model);
};
export type FocusedState = Exclude<ModelState, Blurred>;

/**
 * @group Selectors
 *
 * This function returns the value that the input element should have.
 */
export const toCurrentInputValue = <TItem>(
  config: Config<TItem>,
  model: Model<TItem>
): string => {
  if (model.inputMode.type === "select-only") {
    return modelToInputValue(config, model);
  }

  if (model.type === "blurred") {
    return modelToInputValue(config, model);
  }

  return toSearchValue(model);
};

/**
 * @group Selectors
 *
 * This function returns the highlighted item.
 */
export const toHighlightedItem = <TItem>(
  config: Config<TItem>,
  model: Model<TItem>
): TItem | null => {
  switch (model.type) {
    case "focused__opened__highlighted": {
      const item = toVisibleItems(config, model)[model.highlightIndex];

      return item ?? null;
    }
    default: {
      return null;
    }
  }
};

/**
 * @group Selectors
 *
 * Utility function to determine if an item is highlighted.
 */
export const isItemHighlighted = <TItem>(
  config: Config<TItem>,
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
 * @group Selectors
 *
 * This function returns the selected item
 */
export const toSelections = <TItem>(model: Model<TItem>): TItem[] => {
  return model.selectedItems;
};

/**
 * @group Selectors
 *
 * This function returns the selected item
 */
export const toSelectedItem = <TItem>(model: Model<TItem>): TItem | null => {
  if (isNonEmpty(model.selectedItems)) {
    return model.selectedItems[0];
  }
  return null;
};

/**
 * @group Selectors
 *
 * Utility function to determine if an item is selected.
 */
export const isItemSelected = <TItem>(
  { toItemId }: Pick<Config<TItem>, "toItemId">,
  model: Model<TItem>,
  item: TItem
): boolean => {
  return model.selectedItems.some((x) => toItemId(x) === toItemId(item));
};

/**
 * @group Selectors
 *
 * Selector function to determine if an index is selected.
 */
export const isItemIndexHighlighted = <TItem>(
  model: Model<TItem>,
  index: number
): boolean => {
  switch (model.type) {
    case "focused__opened__highlighted": {
      return model.highlightIndex === index;
    }
    default: {
      return false;
    }
  }
};

/**
 * @group Selectors
 *
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
 *
 * @group Selectors
 *
 */
export const isSelectedItemFocused = <T>(
  config: Config<T>,
  model: Model<T>,
  selectedItem: T
) => {
  return (
    isSelectedItemHighlighted(model) &&
    model.selectedItems.findIndex(
      (item) => config.toItemId(item) === config.toItemId(selectedItem)
    ) === model.focusedIndex
  );
};

/**
 * @group Selectors
 *
 * This type represents all the possible states of an item
 */
export type ItemStatus =
  | "selected-and-highlighted"
  | "selected"
  | "highlighted"
  | "unselected";

/**
 * @group Selectors
 *
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
 * @group Selectors
 *
 * This function returns the all the visible items.
 */
export const toVisibleItems = <T>(config: Config<T>, model: Model<T>): T[] => {
  if (model.inputMode.type === "select-only") {
    return model.allItems;
  }
  return config.deterministicFilter(model);
};

/** @module Helpers **/

/**
 * @group Helpers
 *
 * This helper function converts a keyboard event key property to a message.
 **/
export const keyToMsg = <T>(
  key: string
): Msg<T> & { shouldPreventDefault?: boolean } => {
  const eq = (a: string, b: string) =>
    a.toLowerCase().trim() === b.toLowerCase().trim();

  if (eq(key, "Backspace")) {
    return {
      type: "pressed-backspace-key",
    };
  }

  if (eq(key, "ArrowLeft")) {
    return {
      type: "pressed-horizontal-arrow-key",
      key: "arrow-left",
    };
  }

  if (eq(key, "ArrowRight")) {
    return {
      type: "pressed-horizontal-arrow-key",
      key: "arrow-right",
    };
  }

  if (eq(key, "ArrowDown")) {
    return {
      type: "pressed-vertical-arrow-key",
      key: "arrow-down",
      shouldPreventDefault: true,
    };
  }

  if (eq(key, "ArrowUp")) {
    return {
      type: "pressed-vertical-arrow-key",
      key: "arrow-up",
      shouldPreventDefault: true,
    };
  }

  if (eq(key, "Escape")) {
    return { type: "pressed-escape-key" };
  }

  if (eq(key, "Enter")) {
    return { type: "pressed-enter-key", shouldPreventDefault: true };
  }

  return { type: "pressed-key", key };
};

export const toSelectedItemDirection = <T>(
  model: Model<T>
): SelectedItemListDirection | null => {
  if (model.selectMode.type === "multi-select") {
    return model.selectMode.selectedItemListDirection;
  }
  return null;
};

/**
 * @group Selectors
 *
 * This function returns an object of all the returns of all the selectors.
 */
export const toState = <T>(config: Config<T>, model: Model<T>) => {
  return {
    aria: aria(config, model),
    allItems: model.allItems,
    visibleItems: toVisibleItems(config, model),
    isOpened: isOpened(model),
    selectedItems: toSelections(model),
    inputValue: toCurrentInputValue(config, model),
    isBlurred: isBlurred(model),
    isFocused: isFocused(model),
    selectedItem: toSelectedItem(model),
    highlightedItem: toHighlightedItem(config, model),
    selectedItemDirection: toSelectedItemDirection(model),
    isItemHighlighted: (item: T) => isItemHighlighted<T>(config, model, item),
    isItemSelected: (item: T) => isItemSelected<T>(config, model, item),
    isItemIndexHighlighted: (index: number) =>
      isItemIndexHighlighted<T>(model, index),
    itemStatus: (item: T) => toItemStatus(config, model, item),
    isSelectedItemFocused: (selectedItem: T) =>
      isSelectedItemFocused(config, model, selectedItem),
  } as const;
};

/**
 *
 * @param updateOutput
 * @param handlers
 *
 *
 * Helper function to run effects with less boilerplate.
 */
export const runEffects = <T>(
  { effects }: { effects: Effect<T>[] },
  handlers: {
    scrollItemIntoView: (item: T) => void;
    focusInput: () => void;
    focusSelectedItem: (selectedIem: T) => void;
  }
) => {
  for (const effect of effects) {
    switch (effect.type) {
      case "scroll-item-into-view": {
        handlers.scrollItemIntoView(effect.item);
        break;
      }
      case "focus-selected-item": {
        handlers.focusSelectedItem(effect.item);
        break;
      }
      case "focus-input": {
        handlers.focusInput();
        break;
      }
    }
  }
};
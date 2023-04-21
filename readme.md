# headless-autocomplete

- ⚡️ Zero dependencies
- 🔍 Framework agnostic
- 💪 Written in TypeScript
- 🧠 Headless. Bring your own styles.
- 🔌 Simple pure functional API
- 💼 Runs anywhere JavaScript runs. Like React, React Native, Vue, Svelte, Node.js, etc.

## Links

- [Documentation](https://headless-autocomplete.vercel.app/)

- [Github](https://github.com/crvouga/headless-autocomplete)

- [NPM](https://www.npmjs.com/package/headless-autocomplete)

## Installation

### NPM

```shell
npm install headless-autocomplete
```

### Yarn

```shell
yarn add headless-autocomplete
```

### PNPM

```shell
pnpm install headless-autocomplete
```

Or copy & paste it into your source code. It's just one file with zero dependencies.

## TODO

- Multi select

- Accessibility Helpers (you can do this yourself since its headless)

- Maybe add adapters for frameworks (like React, React Native, Vue, Svelte)

## Usage

### React

```ts
import { useRef, useState } from "react";
import * as Autocomplete from "headless-autocomplete";

//
//
// Step 0. Define Your data
//
//

type Movie = {
  year: number;
  label: string;
};

//
//
// Step 1: Define the config
//
//

const config: Autocomplete.Config<Movie> = {
  toId: (item) => item.label,
  toInputValue: (item) => item.label,
  toFiltered: (model) => {
    return model.allItems.filter((item) =>
      item.label
        .toLowerCase()
        .includes(Autocomplete.toInputValue(config, model).toLowerCase())
    );
  },
};

function App() {
  //
  //
  // Step 2. Initialize the state
  //
  //

  const [state, setState] = useState(
    Autocomplete.init<Movie>({
      allItems: top100Films,
    })
  );

  //
  //
  // Step 3. Update the state
  //
  //

  const dispatch = async (msg: Autocomplete.Msg<Movie>) => {
    const input = { msg, model: state };
    const output = Autocomplete.update(config, input);

    setState(output.model);

    // wait for dropdown to render
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Run Effects
    for (const effect of output.effects ?? []) {
      if (effect.type === "scroll-item-into-view") {
        const ref = refs.current.get(config.toId(effect.item));
        ref?.scrollIntoView({
          block: "nearest",
        });
      }
    }

    // Debug Logger
    Autocomplete.debug({
      log: console.log,
      input,
      output,
    });
  };

  const inputRef = useRef<HTMLInputElement | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());

  //
  //
  // Step 4. Wire up to the view
  //
  //

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "400px",
        margin: "auto",
        color: "#fff",
        padding: "1rem",
      }}>
      <div
        style={{
          width: "100%",
          textAlign: "left",
          padding: "1rem",
        }}>
        {state.type}
      </div>

      <input
        ref={inputRef}
        onInput={(event) =>
          dispatch({
            type: "inputted-value",
            inputValue: event.currentTarget.value,
          })
        }
        onBlur={() => dispatch({ type: "blurred-input" })}
        onFocus={() => dispatch({ type: "focused-input" })}
        value={Autocomplete.toInputValue(config, state)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "0.5rem",
          fontSize: "1.5rem",
        }}
        onClick={() => {
          dispatch({ type: "pressed-input" });
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            dispatch({ type: "pressed-arrow-key", key: "arrow-down" });
          }

          if (event.key === "ArrowUp") {
            dispatch({ type: "pressed-arrow-key", key: "arrow-up" });
          }

          if (event.key === "Escape") {
            dispatch({ type: "pressed-escape-key" });
          }

          if (event.key === "Enter") {
            dispatch({ type: "pressed-enter-key" });
          }
        }}
      />

      {Autocomplete.isOpened(state) && (
        <div
          style={{
            width: "100%",
            textAlign: "left",
            paddingTop: "1rem",
            overflowY: "scroll",
            maxHeight: "400px",
            background: "rgba(0.6, 0.6, 0.6)",
            fontFamily: "monospace",
          }}>
          {config.toFiltered(state).map((item, index) => (
            <div
              key={item.label}
              ref={(ref) => {
                if (ref) {
                  refs.current.set(config.toId(item), ref);
                }
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                dispatch({ type: "pressed-item", item });
              }}
              onMouseEnter={() =>
                dispatch({ type: "hovered-over-item", index })
              }
              style={{
                padding: "0.5rem",
                ...(Autocomplete.isItemSelected(config, state, item)
                  ? {
                      background: "rgba(255, 255, 255, 0.8)",
                      color: "black",
                    }
                  : {}),
                ...(Autocomplete.isIndexHighlighted(state, index)
                  ? {
                      background: "white",
                      color: "black",
                    }
                  : {}),
              }}>
              {item.label} ({item.year})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Top 100 films as rated by IMDb users. http://www.imdb.com/chart/top
const top100Films: Movie[] = [
  { label: "The Shawshank Redemption", year: 1994 },
  { label: "The Godfather", year: 1972 },
  { label: "The Godfather: Part II", year: 1974 },
  { label: "The Dark Knight", year: 2008 },
  { label: "12 Angry Men", year: 1957 },
  { label: "Schindler's List", year: 1993 },
  { label: "Pulp Fiction", year: 1994 },
  {
    label: "The Lord of the Rings: The Return of the King",
    year: 2003,
  },
  { label: "The Good, the Bad and the Ugly", year: 1966 },
  { label: "Fight Club", year: 1999 },
  {
    label: "The Lord of the Rings: The Fellowship of the Ring",
    year: 2001,
  },
  {
    label: "Star Wars: Episode V - The Empire Strikes Back",
    year: 1980,
  },
  { label: "Forrest Gump", year: 1994 },
  { label: "Inception", year: 2010 },
  {
    label: "The Lord of the Rings: The Two Towers",
    year: 2002,
  },
  { label: "One Flew Over the Cuckoo's Nest", year: 1975 },
  { label: "Goodfellas", year: 1990 },
  { label: "The Matrix", year: 1999 },
  { label: "Seven Samurai", year: 1954 },
  {
    label: "Star Wars: Episode IV - A New Hope",
    year: 1977,
  },
  { label: "City of God", year: 2002 },
  { label: "Se7en", year: 1995 },
  { label: "The Silence of the Lambs", year: 1991 },
  { label: "It's a Wonderful Life", year: 1946 },
  { label: "Life Is Beautiful", year: 1997 },
  { label: "The Usual Suspects", year: 1995 },
  { label: "Léon: The Professional", year: 1994 },
  { label: "Spirited Away", year: 2001 },
  { label: "Saving Private Ryan", year: 1998 },
  { label: "Once Upon a Time in the West", year: 1968 },
  { label: "American History X", year: 1998 },
  { label: "Interstellar", year: 2014 },
  { label: "Casablanca", year: 1942 },
  { label: "City Lights", year: 1931 },
  { label: "Psycho", year: 1960 },
  { label: "The Green Mile", year: 1999 },
  { label: "The Intouchables", year: 2011 },
  { label: "Modern Times", year: 1936 },
  { label: "Raiders of the Lost Ark", year: 1981 },
  { label: "Rear Window", year: 1954 },
  { label: "The Pianist", year: 2002 },
  { label: "The Departed", year: 2006 },
  { label: "Terminator 2: Judgment Day", year: 1991 },
  { label: "Back to the Future", year: 1985 },
  { label: "Whiplash", year: 2014 },
  { label: "Gladiator", year: 2000 },
  { label: "Memento", year: 2000 },
  { label: "The Prestige", year: 2006 },
  { label: "The Lion King", year: 1994 },
  { label: "Apocalypse Now", year: 1979 },
  { label: "Alien", year: 1979 },
  { label: "Sunset Boulevard", year: 1950 },
  {
    label:
      "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb",
    year: 1964,
  },
  { label: "The Great Dictator", year: 1940 },
  { label: "Cinema Paradiso", year: 1988 },
  { label: "The Lives of Others", year: 2006 },
  { label: "Grave of the Fireflies", year: 1988 },
  { label: "Paths of Glory", year: 1957 },
  { label: "Django Unchained", year: 2012 },
  { label: "The Shining", year: 1980 },
  { label: "WALL·E", year: 2008 },
  { label: "American Beauty", year: 1999 },
  { label: "The Dark Knight Rises", year: 2012 },
  { label: "Princess Mononoke", year: 1997 },
  { label: "Aliens", year: 1986 },
  { label: "Oldboy", year: 2003 },
  { label: "Once Upon a Time in America", year: 1984 },
  { label: "Witness for the Prosecution", year: 1957 },
  { label: "Das Boot", year: 1981 },
  { label: "Citizen Kane", year: 1941 },
  { label: "North by Northwest", year: 1959 },
  { label: "Vertigo", year: 1958 },
  {
    label: "Star Wars: Episode VI - Return of the Jedi",
    year: 1983,
  },
  { label: "Reservoir Dogs", year: 1992 },
  { label: "Braveheart", year: 1995 },
  { label: "M", year: 1931 },
  { label: "Requiem for a Dream", year: 2000 },
  { label: "Amélie", year: 2001 },
  { label: "A Clockwork Orange", year: 1971 },
  { label: "Like Stars on Earth", year: 2007 },
  { label: "Taxi Driver", year: 1976 },
  { label: "Lawrence of Arabia", year: 1962 },
  { label: "Double Indemnity", year: 1944 },
  {
    label: "Eternal Sunshine of the Spotless Mind",
    year: 2004,
  },
  { label: "Amadeus", year: 1984 },
  { label: "To Kill a Mockingbird", year: 1962 },
  { label: "Toy Story 3", year: 2010 },
  { label: "Logan", year: 2017 },
  { label: "Full Metal Jacket", year: 1987 },
  { label: "Dangal", year: 2016 },
  { label: "The Sting", year: 1973 },
  { label: "2001: A Space Odyssey", year: 1968 },
  { label: "Singin' in the Rain", year: 1952 },
  { label: "Toy Story", year: 1995 },
  { label: "Bicycle Thieves", year: 1948 },
  { label: "The Kid", year: 1921 },
  { label: "Inglourious Basterds", year: 2009 },
  { label: "Snatch", year: 2000 },
  { label: "3 Idiots", year: 2009 },
  { label: "Monty Python and the Holy Grail", year: 1975 },
];

export default App;
```

# BRFC Match Graphics

## Fast CapCut render

The website creates the scoreboard project. The included local renderer creates the green-screen MP4 much faster than real time.

1. In the website, enter the final video length, add match events and click **Download render project**.
2. Install [Node.js LTS](https://nodejs.org/) once.
3. Download or clone this repository. On Windows, drag the downloaded render project onto `render-project.bat`. It installs the renderer on the first use and writes the MP4 beside your JSON project.

You can also run it from a terminal:

```bash
npm install
npm run render -- "C:\path\to\BRFC-vs-Real-Magrib-render-project.json"
```

The renderer writes an `-greenscreen.mp4` file beside the downloaded project. Import it above the match footage in CapCut and apply Chroma Key to green.

Standalone prototype for adding a professional football scoreboard to recorded friendly-match footage.

## Prototype workflow

1. Enter the match details and add team logos.
2. In CapCut, finish the timing structure of the match edit and note the timeline positions of kick-off, goals, half-time and full-time.
3. Enter each position in the overlay timeline, then mark the relevant event.
4. Set the final edit duration and click **Render green-screen overlay**.
5. Keep the browser tab open while it renders in real time.
6. Import the downloaded `.webm` above the match in CapCut and use Chroma Key to remove the green background.

The overlay is generated locally in the browser. No match video is uploaded or stored online.

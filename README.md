# HSPICE Language Support for VS Code

![HSPICE Extension Preview](hspice-netlist.png)

This extension provides robust syntax highlighting, code snippets, and visual tools for **HSPICE** netlists (`.sp`, `.lis`, `.hsp`). It is designed to make circuit simulation workflows faster and less error-prone.

## Features

* **Visual Signal Generator (New!):**
    * Interactively design **PULSE** and **SIN** voltage sources.
    * **Global Parameter Support:** Define `.param` variables (e.g., `tr_global`) and link them to multiple signal cards for synchronized updates.
    * **Smart Input Scrolling:** Hover and scroll over any numeric field to increment/decrement values with intelligent decade scaling (e.g., 1u -> 900n -> 800n).
    * **Real-time Visualization:** See waveforms update instantly as you adjust parameters.
    * **Global Time Scaling:** Check signal alignment across multiple sources with a synchronized ruler.
* **Visual PWL Designer:**
    * Graphically draw Piece-Wise Linear (PWL) sources point-by-point.
    * Waveform generator primitives for Square, Triangle, and Sawtooth waves.
* **Syntax Highlighting:**
    * Case-insensitive support (e.g., `.TRAN` and `.tran` are both recognized).
    * Differentiates between **Simulations** (`.tran`, `.ac`), **Definitions** (`.subckt`, `.param`), and **Options** (`.option`).
    * Highlights engineering units (`u`, `n`, `meg`, `k`).
* **Intelligent Snippets:**
    * Auto-completion for complex sources (`PULSE`, `SIN`, `PWL`).
    * Templates for analyses (`.tran`, `.dc`, `.ac`) with tab-stops.

---

## Visual Signal Generator

Design complex independent sources without memorizing the parameter order. This tool generates not just the signal lines, but also the necessary `.param` definitions.

![HSPICE Signal Generator](signals-generator.png)

### Technical Workflow

#### 1. Global Configuration
* **Time Scale:** Set the global simulation time (e.g., `10u`) and units at the top left. All signals render relative to this window.
* **Global Parameters (`.param`):**
    1.  Click the **Settings (Slider)** icon next to the Add button.
    2.  Select a parameter type (e.g., `Rise Time (tr)`) and click **Add**.
    3.  Assign a variable name (e.g., `tr_glob`) and a value (e.g., `1n`).
    4.  Click **Apply**. This creates a global `.param` block in the output code.

#### 2. Signal Creation
* Click the **(+)** button to add a new card.
* Select **Pulse** or **Sin** from the dropdown.
* **Variable Binding:** Inside a signal card, you can enter a hardcoded number (e.g., `5n`) OR reference a global parameter name (e.g., `tr_glob`). The waveform will automatically resolve the variable value.

#### 3. Interactive Adjustment
* **Smart Scroll:** Hover your mouse over any input field (like Voltage or Period) and scroll up/down.
    * *Logic:* The tool uses decade-aware stepping. If you scroll down from `1.0`, it steps to `0.9` (step 0.1). If you scroll down from `100`, it steps to `90` (step 10).
* **Visual Cursors:** Hover over the graph to see exact Voltage/Time coordinates. A horizontal guide line appears on the active signal to help align levels.

#### 4. Code Generation
* The generated code includes the Parameter block followed by the Source definitions:
    ```spice
    * Global Parameters
    .param tr_glob = 1n
    
    * Signals
    V_Clk V_Clk 0 PULSE(0 1.8 0 tr_glob tr_glob 5u 10u)
    ```

---

## Visual PWL Designer

Stop manually typing coordinate pairs! This tool allows you to draw PWL sources spatially.

![HSPICE PWL Visual Designer](pwl-generator.png)

### Technical Workflow
1.  **Launch:** Run `HSPICE: Open Visual PWL Designer` from the command palette.
2.  **Draw Mode:**
    * **Left Click:** Adds a new voltage/time point to the PWL list.
    * **Right Click:** Removes the last added point (Undo).
    * **Drag Point:** Click and hold an existing point to adjust its timing or voltage visually.
3.  **Primitives:** Use the sidebar to generate standard shapes (Triangle, Sawtooth) which are converted into PWL coordinate pairs automatically.
4.  **Export:** The tool generates the tedious `PWL(t1 v1 t2 v2 ...)` string formatted for direct insertion into your netlist.

---

## Snippets Reference

### Source Definitions

| Trigger | Name | Description |
| :--- | :--- | :--- |
| `pulse` | **Pulse Source** | Generates `PULSE(V1 V2 TD TR TF PW PER)` template. |
| `sin` | **Sinusoidal** | Generates `SIN(VO VA FREQ TD THETA)` template. |
| `pwl` | **PWL Source** | Template for Piece-Wise Linear source. |
| `exp` | **Exponential** | Generates `EXP` source template. |

### Analysis Commands

| Trigger | Name | Description |
| :--- | :--- | :--- |
| `.tran` | **Transient** | Sets step, stop, and start times. |
| `.dc` | **DC Sweep** | Sweeps a source from start to stop values. |
| `.ac` | **AC Analysis** | Selects DEC/OCT/LIN via dropdown menu. |
| `.meas` | **Measure** | Template for `.meas TRAN/AC/DC ...` |
| `.meas delay`| **Prop. Delay** | Template for `TRIG` and `TARG` delay measurement. |

### Circuit Definitions

| Trigger | Name | Description |
| :--- | :--- | :--- |
| `.subckt` | **Subcircuit** | Creates a `.SUBCKT` block with `.ENDS`. |
| `.param` | **Parameter** | Defines a variable (e.g., `vdd=3.3`). |
| `.option` | **Options** | Adds `.option post=1` or other settings. |
| `.inc` | **Include** | Includes an external netlist file. |
| `.lib` | **Library** | Loads a model library file. |

---

## Author

**Muhammad Shofuwan Anwar**
* Email: muh.shofuwan.a@mail.ugm.ac.id
* LinkedIn: [linkedin.com/in/mshofuwan-anwar/](https://www.linkedin.com/in/mshofuwan-anwar/)
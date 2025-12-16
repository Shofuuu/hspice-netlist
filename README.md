# HSPICE Language Support for VS Code

![HSPICE Extension Preview](hspice-netlist.png)

This extension provides robust syntax highlighting and code snippets for **HSPICE** netlists (`.sp`, `.lis`, `.hsp`). It is designed to make circuit simulation workflows faster and less error-prone by providing "cheat sheet" style auto-completion.

## Features

* **Syntax Highlighting:**
    * Case-insensitive support (e.g., `.TRAN` and `.tran` are both recognized).
    * Differentiates between **Simulations** (`.tran`, `.ac`), **Definitions** (`.subckt`, `.param`), and **Options** (`.option`).
    * Highlights engineering units (`u`, `n`, `meg`, `k`).
    * Supports full-line comments (`*`) and inline comments (`$`).
* **Intelligent Snippets:**
    * Auto-completion for complex sources (`PULSE`, `SIN`, `PWL`).
    * Templates for analyses (`.tran`, `.dc`, `.ac`) with tab-stops.
    * Dropdown menus for `.meas` analysis types.

---

## HSPICE Cheat Sheet (Snippets)

Type the **Trigger** command and press `Tab` or `Enter` to expand it.

### Sources & Stimuli

| Trigger | Name | Expands To (Example) |
| :--- | :--- | :--- |
| `pulse` | **Pulse Source** | `PULSE(v1 v2 td tr tf pw per)` |
| `sin` | **Sinusoidal** | `SIN(vo va freq td theta phase)` |
| `pwl` | **Piece-Wise Linear** | `PWL(t1 v1 t2 v2 t3 v3)` |
| `ic` | **Initial Condition** | `.IC V(node)=voltage` |

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

## Syntax Highlighting Rules

This extension follows standard HSPICE formatting rules:

| Element | Rule | Example |
| :--- | :--- | :--- |
| **Comments** | Starts with `*` (full line) or `$` (inline). | `* This is a comment` <br> `R1 1 0 1k $ Resistor` |
| **Line Break** | Starts with `+` at the beginning of a line. | `.tran 1n 100n`<br>`+ start=0` |
| **Numbers** | Supports engineering suffixes. | `10k`, `0.1u`, `10meg`, `1.5T` |
| **Options** | Highlights keys and values differently. | `.option runlvl=6 method=gear` |

---

## Author

**Muhammad Shofuwan Anwar**
Email: [muh.shofuwan.a@mail.ugm.ac.id](mailto:muh.shofuwan.a@mail.ugm.ac.id)
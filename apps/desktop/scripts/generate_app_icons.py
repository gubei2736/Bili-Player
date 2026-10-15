import os
import subprocess
from PIL import Image

def generate_icon(output_png_path):
    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    
    # We want crisp vector shapes, centered perfectly, with just enough breathing room (padding 4-5%)
    # In 100x100 space, graphics bounds: x ~ 12 to 88 (width 76), y ~ 15 to 78 (height 63).
    # Centered at (50, 46.5).
    # Let's use viewBox="6 4 88 88" which gives a square 88x88 viewport.
    # 6 to 94 covers 12 to 88 with 6 units left/right padding.
    # 4 to 92 covers 15 to 78 with 11 units top padding, 14 units bottom padding.
    # Perfectly centered and balanced!
    svg_content = """
    <svg viewBox="6 4 88 88" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1024px; height: 1024px;">
        <defs>
            <!-- Gradient: Bili Blue to Bili Pink -->
            <linearGradient id="biliGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00AEEC" />
                <stop offset="50%" stop-color="#23ADE5" />
                <stop offset="100%" stop-color="#FB7299" />
            </linearGradient>
            <!-- Glow accent -->
            <linearGradient id="neonPink" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FF6699" />
                <stop offset="100%" stop-color="#FB7299" />
            </linearGradient>
            <linearGradient id="headphoneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#38BDF8" />
                <stop offset="100%" stop-color="#0284C7" />
            </linearGradient>
            <filter id="crispGlow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35" />
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#00AEEC" flood-opacity="0.2" />
            </filter>
        </defs>

        <g filter="url(#crispGlow)">
            <!-- Headphone Arch Band -->
            <path
                d="M18 48 C 18 20, 82 20, 82 48"
                stroke="url(#headphoneGrad)"
                stroke-width="6.5"
                stroke-linecap="round"
                fill="none"
                opacity="0.95"
            />

            <!-- Left TV Antenna -->
            <line
                x1="36"
                y1="34"
                x2="27"
                y2="20"
                stroke="#00AEEC"
                stroke-width="4.5"
                stroke-linecap="round"
            />
            <circle cx="26" cy="19" r="2.8" fill="#00AEEC" />

            <!-- Right TV Antenna -->
            <line
                x1="64"
                y1="34"
                x2="73"
                y2="20"
                stroke="#FB7299"
                stroke-width="4.5"
                stroke-linecap="round"
            />
            <circle cx="74" cy="19" r="2.8" fill="#FB7299" />

            <!-- TV Main Body (Squircle) -->
            <rect
                x="22"
                y="32"
                width="56"
                height="46"
                rx="14"
                fill="url(#biliGrad)"
            />

            <!-- TV Screen Display (Dark glassy inner) -->
            <rect
                x="27"
                y="37"
                width="46"
                height="36"
                rx="10"
                fill="#0B0F19"
                stroke="rgba(255,255,255,0.2)"
                stroke-width="1.6"
            />

            <!-- TV Screen Inner Glow / Vinyl Groove Effect -->
            <circle
                cx="50"
                cy="55"
                r="13"
                stroke="rgba(0,174,236,0.3)"
                stroke-width="1.2"
                fill="none"
                stroke-dasharray="2.5 2.5"
            />

            <!-- Mascot Face: Left Eye -->
            <ellipse cx="41" cy="52" rx="2.8" ry="3.8" fill="#23ADE5" />
            <!-- Mascot Face: Right Eye -->
            <ellipse cx="59" cy="52" rx="2.8" ry="3.8" fill="#FB7299" />

            <!-- Mascot Face: Cute Smiling Mouth -->
            <path
                d="M45 59.5 Q 50 64.5 55 59.5"
                stroke="#FFFFFF"
                stroke-width="2.4"
                stroke-linecap="round"
                fill="none"
            />

            <!-- Left Earphone Cushion -->
            <rect
                x="12"
                y="43.5"
                width="9"
                height="23"
                rx="4.5"
                fill="url(#headphoneGrad)"
                stroke="#0B0F19"
                stroke-width="1.5"
            />

            <!-- Right Earphone Cushion -->
            <rect
                x="79"
                y="43.5"
                width="9"
                height="23"
                rx="4.5"
                fill="url(#neonPink)"
                stroke="#0B0F19"
                stroke-width="1.5"
            />

            <!-- Small Music Note floating on top right -->
            <path
                d="M80 18 L88 15 L88 23 M80 26 C80 28 77 29 75 28 C73 27 73 25 75 24 C77 23 80 24 80 26 L80 18 M88 23 C88 25 85 26 83 25 C81 24 81 22 83 21 C85 20 88 21 88 23"
                fill="#FB7299"
            />
        </g>
    </svg>
    """

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{
    width: 1024px;
    height: 1024px;
    background: transparent;
    overflow: hidden;
  }}
</style>
</head>
<body>
{svg_content}
</body>
</html>"""

    html_file = os.path.abspath("temp_icon.html")
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)

    abs_output = os.path.abspath(output_png_path)
    cmd = [
        edge_path,
        "--headless=new",
        "--disable-gpu",
        "--force-device-scale-factor=1",
        "--default-background-color=00000000",
        "--window-size=1024,1024",
        f"--screenshot={abs_output}",
        f"file:///{html_file.replace(os.sep, '/')}"
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(html_file):
        os.remove(html_file)
    print(f"Generated master icon: {abs_output}")

if __name__ == "__main__":
    generate_icon("master_icon_1024.png")

#!/usr/bin/env python3
"""Setup local de nodo-obra."""
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / "venv"
PY = VENV / "bin" / "python"


def run(cmd, **kwargs):
    print("+", " ".join(str(c) for c in cmd))
    subprocess.check_call(cmd, cwd=ROOT, **kwargs)


def venv_has_pip() -> bool:
    if not PY.exists():
        return False
    try:
        subprocess.run(
            [str(PY), "-m", "pip", "--version"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def ensure_venv():
    if VENV.exists() and not venv_has_pip():
        print("! venv incompleto (sin pip). Borrando y recreando...")
        shutil.rmtree(VENV)

    if not VENV.exists():
        try:
            run([sys.executable, "-m", "venv", str(VENV)])
        except subprocess.CalledProcessError as exc:
            _die_venv_packages(exc)

    if not venv_has_pip():
        try:
            run([str(PY), "-m", "ensurepip", "--upgrade"])
        except subprocess.CalledProcessError as exc:
            _die_venv_packages(exc)

    if not venv_has_pip():
        print(
            "\nNo se pudo instalar pip en el entorno virtual.\n"
            "Instalá los paquetes del sistema y volvé a ejecutar:\n\n"
            "  sudo apt install -y python3-pip python3.12-venv\n"
            "  rm -rf venv\n"
            "  python3 setup_local.py\n"
        )
        sys.exit(1)


def _die_venv_packages(exc):
    print(
        "\nNo se pudo crear el entorno virtual.\n"
        "Instalá primero:\n\n"
        "  sudo apt install -y python3-pip python3.12-venv\n\n"
        f"Detalle: {exc}\n"
    )
    sys.exit(1)


def main():
    os.chdir(ROOT)
    ensure_venv()

    run([str(PY), "-m", "pip", "install", "-q", "-r", "requirements.txt"])
    run([str(PY), "manage.py", "migrate"])
    run([str(PY), "manage.py", "cargar_rubros"])
    run([str(PY), "manage.py", "check"])

    print()
    print("Listo. Para arrancar:")
    print(f"  source {VENV}/bin/activate")
    print("  python manage.py runserver 8001")
    print()
    print("Abrí: http://127.0.0.1:8001/")
    print("Si no tenés usuario: python manage.py createsuperuser")


if __name__ == "__main__":
    main()

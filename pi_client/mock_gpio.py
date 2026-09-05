# mock_gpio.py — Fake GPIO for Windows laptop testing

BCM = "BCM"
OUT = "OUT"
HIGH = 1
LOW = 0

_pin_states = {}


def setmode(mode):
    print(f"[MockGPIO] setmode({mode})")


def setup(pin, mode):
    _pin_states[pin] = LOW
    print(f"[MockGPIO] setup pin {pin} as {mode}")


def output(pin, state):
    if _pin_states.get(pin) != state:
        _pin_states[pin] = state
        label = "HIGH" if state == HIGH else "LOW"
        print(f"[MockGPIO] pin {pin} -> {label}")


def cleanup():
    print("[MockGPIO] cleanup()")
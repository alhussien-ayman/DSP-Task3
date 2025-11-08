import numpy as np
import matplotlib.pyplot as plt

w = np.linspace(-np.pi, np.pi, 1001)
H = 1 + np.exp(-1j*4*w)

mag = np.abs(H)
phase = np.angle(H)  # principal value in [-pi,pi]

# But for clearer phase showing the -2w + pi flips, unwrap:
phase_unwrapped = np.unwrap(np.angle(H))

plt.figure(figsize=(10,4))
plt.subplot(1,2,1)
plt.plot(w, mag)
plt.title('|H(e^{jω})|')
plt.xlabel('ω (rad)')
plt.grid(True)

plt.subplot(1,2,2)
plt.plot(w, phase_unwrapped)
plt.title('Phase of H(e^{jω}) (unwrapped)')
plt.xlabel('ω (rad)')
plt.grid(True)

plt.tight_layout()
plt.show()

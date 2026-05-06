// WebUSB device manager for the cashier's Epson printer. The cashier PC
// must already have the printer on the WinUSB driver (replaced via Zadig);
// the browser then sees it as a generic USB device.
//
// @types/w3c-web-usb is not installed — minimal local types live below so
// strict TS compiles without pulling a dependency.

export const EPSON_VENDOR_ID = 0x04b8

export interface USBEndpoint {
  endpointNumber: number
  direction: 'in' | 'out'
  type: 'bulk' | 'interrupt' | 'isochronous'
  packetSize: number
}

export interface USBAlternateInterface {
  alternateSetting: number
  interfaceClass: number
  interfaceSubclass: number
  interfaceProtocol: number
  endpoints: USBEndpoint[]
}

export interface USBInterface {
  interfaceNumber: number
  alternate: USBAlternateInterface
  alternates: USBAlternateInterface[]
  claimed: boolean
}

export interface USBConfiguration {
  configurationValue: number
  interfaces: USBInterface[]
}

export interface USBOutTransferResult {
  bytesWritten: number
  status: 'ok' | 'stall' | 'babble'
}

export interface USBDevice {
  vendorId: number
  productId: number
  productName?: string
  manufacturerName?: string
  opened: boolean
  configuration: USBConfiguration | null
  configurations: USBConfiguration[]
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  transferOut(
    endpointNumber: number,
    data: Uint8Array | ArrayBuffer,
  ): Promise<USBOutTransferResult>
}

interface USBDeviceFilter {
  vendorId?: number
  productId?: number
}

interface USB {
  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<USBDevice>
  getDevices(): Promise<USBDevice[]>
}

declare global {
  interface Navigator {
    usb?: USB
  }
}

export const WEBUSB_SUPPORTED: boolean =
  typeof navigator !== 'undefined' && typeof navigator.usb !== 'undefined'

function getUsb(): USB {
  if (!navigator.usb) {
    throw new Error('WebUSB is not supported in this browser')
  }
  return navigator.usb
}

// Must be invoked from a user-gesture handler — Chrome rejects the call
// from useEffect or any non-interactive code path.
export async function requestPrinter(): Promise<USBDevice> {
  try {
    return await getUsb().requestDevice({
      filters: [{ vendorId: EPSON_VENDOR_ID }],
    })
  } catch (err) {
    console.error('[WebUSB] requestDevice failed', err)
    throw err
  }
}

export async function getGrantedPrinter(): Promise<USBDevice | null> {
  try {
    const devices = await getUsb().getDevices()
    return devices.find((d) => d.vendorId === EPSON_VENDOR_ID) ?? null
  } catch (err) {
    console.error('[WebUSB] getDevices failed', err)
    throw err
  }
}

export async function openPrinter(
  device: USBDevice,
): Promise<{ device: USBDevice; endpointOut: number }> {
  try {
    if (!device.opened) await device.open()
    if (
      !device.configuration ||
      device.configuration.configurationValue !== 1
    ) {
      await device.selectConfiguration(1)
    }
    const iface = device.configuration?.interfaces?.[0]
    if (!iface) throw new Error('No USB interface on device')
    if (!iface.claimed) await device.claimInterface(iface.interfaceNumber)
    const outEndpoint = iface.alternate.endpoints.find(
      (e) => e.direction === 'out' && e.type === 'bulk',
    )
    if (!outEndpoint) throw new Error('No bulk OUT endpoint found')
    return { device, endpointOut: outEndpoint.endpointNumber }
  } catch (err) {
    console.error('[WebUSB] openPrinter failed', err)
    throw err
  }
}

export async function writeToPrinter(
  device: USBDevice,
  endpointOut: number,
  data: Uint8Array,
): Promise<USBOutTransferResult> {
  try {
    return await device.transferOut(endpointOut, data)
  } catch (err) {
    console.error('[WebUSB] transferOut failed', err)
    throw err
  }
}

export async function closePrinter(device: USBDevice): Promise<void> {
  try {
    const iface = device.configuration?.interfaces?.[0]
    if (iface?.claimed) {
      try {
        await device.releaseInterface(iface.interfaceNumber)
      } catch (e) {
        console.error('[WebUSB] releaseInterface failed', e)
      }
    }
    if (device.opened) {
      try {
        await device.close()
      } catch (e) {
        console.error('[WebUSB] close failed', e)
      }
    }
  } catch (err) {
    console.error('[WebUSB] closePrinter failed', err)
  }
}

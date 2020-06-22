# micronets-onboard-proxy

This service is used to facilitate direct-to-gateway onboarding, which bypasses the normal micronets cloud services (micronets-mso-portal, micronets-manager, etc). Its primary use case is for DPP onboarding demonstrations, closing the component loop to contain only the device to be onboarded (Pi), a configurator agent (iOS/Android device) and the gateway/AP device.

More documentation can be found in the [GitHub Wiki](https://github.com/cablelabs/micronets-onboard-proxy/wiki).

## API
The exposed API is the same as for the MSO Portal (DPP routes). It supports the following: 
 - /config - Retrieve list of device classes (micronets) to populate the UI listbox on the mobile device.
 - /session - Check for an active login session
 - /login - Login to the onboard proxy
 - /onboard - Create a new device record on the gateway, assign an IP address, and initiate DPP onboard sequence

 ## iPhone/Android settings
 You need to set the DPP server address to http://<Gateway IP Address>:3010

## Top Level Directory Contents

 - node: The Node.js micronets-onboard-proxy project directory.
 - distribution: The directory where the installation package is built into distribution/target via make.
 - filesystem: The replica static installation package file system. Files put here will be in the package install.
 - LICENSE: MIT License
 - README.md: This file.

**Note: The following build instructions need to be performed on a Debian system - preferably Ubuntu 16.04 LTS**

## Installing Platform Dependencies

```
# Node.js 
sudo apt install nodejs-legacy
```

## Cloning the repository:

```
git clone git@github.com:cablelabs/micronets-onboard-proxy.git
```

## Installing Node.js Package dependencies

```
cd micronets-onboard-proxy/node
npm install

```

## Building a Debian installer for the Micronets Onboard Proxy

```
make -C micronets-onboard-proxy/distribution
```

## Installing the Debian package for the Micronets Onboard Proxy

Note: If the Micronets Onboard Proxy service is running, make sure to stop it using:

```
sudo systemctl stop micronets-onboard-proxy.service 
```

Then install the package using:

```
dpkg -i micronets-onboard-proxy/distribution/target/micronets-onboard-proxy-{ver}.deb
```

where "{ver}" is the version number built above with the `make` command. 
(e.g. "micronets-onboard-proxy-1.0.28.deb")

## Configuration
The Micronets Onboard Proxy needs no configuration, unless it is running on a different machine than the micronets-gw service. In that case, you will need to set the environment variable `gateway` to the IP address of the gateway machine.



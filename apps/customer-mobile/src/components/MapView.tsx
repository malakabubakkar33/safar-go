/**
 * SafarGo Customer Mobile - Real Peshawar Interactive Map Component
 * Renders authentic OpenStreetMap / CartoDB Voyager tiles strictly bounded to Peshawar, Pakistan.
 * Features:
 * - Fixed Peshawar camera & boundaries (cannot zoom out to world view)
 * - Custom "ME" avatar marker with animated emerald pulse ring
 * - Pickup (Green) and Destination (Red) custom pin markers
 * - Driver location marker with vehicle symbol
 * - Real road route polyline with automatic padding fit
 * - Cross-platform: Native WebView (iOS/Android) and HTML5 iframe (Web) with bidirectional postMessage
 * - Floating controls: Recenter to GPS, Accessible Zoom In/Out (+/-), Service Area status pill
 * - Clear OSM / CARTO map attribution
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { PESHAWAR_CENTER, PESHAWAR_MAP_CONFIG, isWithinPeshawar } from '../services/peshawarGeofence';
import { useAuthStore } from '../store/authStore';

const { height: screenHeight } = Dimensions.get('window');

interface LocationCoords {
  lat: number;
  lng: number;
  heading?: number;
}

interface MapViewProps {
  userLocation: LocationCoords | null;
  pickupLocation?: LocationCoords | null;
  destinationLocation?: LocationCoords | null;
  driverLocation?: LocationCoords | null;
  routeCoordinates?: Array<{ lat: number; lng: number }> | null;
  vehicleType?: string;
  height?: number;
  onCenterUser?: () => void;
  onMapReady?: () => void;
}

export function MapView({
  userLocation,
  pickupLocation,
  destinationLocation,
  driverLocation,
  routeCoordinates,
  vehicleType = 'BIKE',
  height = Math.round(screenHeight * 0.41),
  onCenterUser,
  onMapReady,
}: MapViewProps) {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const user = useAuthStore((s) => s.user);

  // Validate initial center: Use pickup if in Peshawar, else user location if in Peshawar, else Peshawar Saddar
  const getInitialCoords = () => {
    if (pickupLocation && isWithinPeshawar(pickupLocation.lat, pickupLocation.lng)) {
      return { lat: pickupLocation.lat, lng: pickupLocation.lng };
    }
    if (userLocation && isWithinPeshawar(userLocation.lat, userLocation.lng)) {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    return { lat: PESHAWAR_CENTER.lat, lng: PESHAWAR_CENTER.lng };
  };

  const initialCoords = getInitialCoords();
  const avatarUrl = user?.avatarUrl && !user.avatarUrl.includes('safargo-symbol') ? user.avatarUrl : '';
  const userInitial = (user?.fullName || user?.username || 'U').charAt(0).toUpperCase();

  // Cross-platform message dispatcher to map canvas
  const postMessageToMap = useCallback((payload: object) => {
    const jsonStr = JSON.stringify(payload);
    if (Platform.OS === 'web') {
      try {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(jsonStr, '*');
        }
      } catch (err) {
        console.warn('[MapView] Web iframe postMessage failed:', err);
      }
    } else {
      webViewRef.current?.postMessage?.(jsonStr);
    }
  }, []);

  // HTML5 Map Document using Leaflet 1.9.4 & CartoDB Voyager tiles
  const mapHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    /* ME User Avatar Marker */
    .user-marker-container {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-pulse {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(22, 163, 74, 0.28);
      animation: pulseAnim 2.2s infinite ease-out;
    }
    .user-avatar-circle {
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #16A34A;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 10px rgba(22, 163, 74, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 13px;
      overflow: hidden;
      z-index: 2;
    }
    .user-avatar-circle img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .user-me-badge {
      position: absolute;
      bottom: -4px;
      background: #15803D;
      color: #FFFFFF;
      font-size: 8px;
      font-weight: 900;
      padding: 1px 4px;
      border-radius: 4px;
      border: 1px solid #FFFFFF;
      z-index: 3;
      letter-spacing: 0.5px;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.6); opacity: 0.95; }
      100% { transform: scale(1.45); opacity: 0; }
    }

    /* Pickup Pin (Green) */
    .pin-pickup {
      width: 28px;
      height: 28px;
      background: #16A34A;
      border: 2.5px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-pickup-inner {
      width: 10px;
      height: 10px;
      background: #FFFFFF;
      border-radius: 50%;
    }

    /* Destination Pin (Red) */
    .pin-dest {
      width: 28px;
      height: 28px;
      background: #DC2626;
      border: 2.5px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-dest-inner {
      width: 10px;
      height: 10px;
      background: #FFFFFF;
      border-radius: 50%;
    }

    /* Driver Vehicle Pin */
    .pin-driver {
      width: 34px;
      height: 34px;
      background: #0F172A;
      border: 2px solid #16A34A;
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
    }

    /* Map Attribution */
    .leaflet-control-attribution {
      font-size: 9px !important;
      background: rgba(255,255,255,0.85) !important;
      padding: 2px 6px !important;
      border-top-left-radius: 4px !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map;
    var userMarker, pickupMarker, destMarker, driverMarker, routeLayer;

    // Strict Peshawar Bounding Limits: users cannot pan or zoom out to the world
    var pshBounds = L.latLngBounds(
      L.latLng(${PESHAWAR_MAP_CONFIG.bounds[0][0]}, ${PESHAWAR_MAP_CONFIG.bounds[0][1]}),
      L.latLng(${PESHAWAR_MAP_CONFIG.bounds[1][0]}, ${PESHAWAR_MAP_CONFIG.bounds[1][1]})
    );

    // Initialize map focused strictly on Peshawar
    map = L.map('map', {
      center: [${initialCoords.lat}, ${initialCoords.lng}],
      zoom: ${PESHAWAR_MAP_CONFIG.defaultZoom},
      minZoom: ${PESHAWAR_MAP_CONFIG.minZoom},
      maxZoom: ${PESHAWAR_MAP_CONFIG.maxZoom},
      maxBounds: pshBounds,
      maxBoundsViscosity: 1.0, // Hard ceiling prevents scrolling beyond Peshawar
      zoomControl: false,
      attributionControl: true
    });

    // Real, licensed CARTO Voyager & OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    // Custom Icon Creators
    function createUserIcon() {
      var imgHtml = '${avatarUrl}' ? '<img src="${avatarUrl}" alt="ME"/>' : '${userInitial}';
      return L.divIcon({
        className: 'user-marker-leaflet',
        html: '<div class="user-marker-container"><div class="user-pulse"></div><div class="user-avatar-circle">' + imgHtml + '</div><div class="user-me-badge">ME</div></div>',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
    }

    var pickupIcon = L.divIcon({
      className: 'pin-pickup-leaflet',
      html: '<div class="pin-pickup"><div class="pin-pickup-inner"></div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    var destIcon = L.divIcon({
      className: 'pin-dest-leaflet',
      html: '<div class="pin-dest"><div class="pin-dest-inner"></div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    var driverIcon = L.divIcon({
      className: 'pin-driver-leaflet',
      html: '<div class="pin-driver">${vehicleType === 'CAR' ? '🚗' : '🏍️'}</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    // Update map markers and route coordinates
    function updateMapState(state) {
      if (!state) return;

      // 1. User Position
      if (state.userLocation && state.userLocation.lat && state.userLocation.lng) {
        if (!userMarker) {
          userMarker = L.marker([state.userLocation.lat, state.userLocation.lng], { icon: createUserIcon() }).addTo(map);
        } else {
          userMarker.setLatLng([state.userLocation.lat, state.userLocation.lng]);
        }
      }

      // 2. Pickup Location
      if (state.pickupLocation && state.pickupLocation.lat && state.pickupLocation.lng) {
        if (!pickupMarker) {
          pickupMarker = L.marker([state.pickupLocation.lat, state.pickupLocation.lng], { icon: pickupIcon }).addTo(map);
        } else {
          pickupMarker.setLatLng([state.pickupLocation.lat, state.pickupLocation.lng]);
        }
      } else if (pickupMarker) {
        map.removeLayer(pickupMarker);
        pickupMarker = null;
      }

      // 3. Destination Location
      if (state.destinationLocation && state.destinationLocation.lat && state.destinationLocation.lng) {
        if (!destMarker) {
          destMarker = L.marker([state.destinationLocation.lat, state.destinationLocation.lng], { icon: destIcon }).addTo(map);
        } else {
          destMarker.setLatLng([state.destinationLocation.lat, state.destinationLocation.lng]);
        }
      } else if (destMarker) {
        map.removeLayer(destMarker);
        destMarker = null;
      }

      // 4. Driver Location
      if (state.driverLocation && state.driverLocation.lat && state.driverLocation.lng) {
        if (!driverMarker) {
          driverMarker = L.marker([state.driverLocation.lat, state.driverLocation.lng], { icon: driverIcon }).addTo(map);
        } else {
          driverMarker.setLatLng([state.driverLocation.lat, state.driverLocation.lng]);
        }
      } else if (driverMarker) {
        map.removeLayer(driverMarker);
        driverMarker = null;
      }

      // 5. Road Route Polyline
      if (state.routeCoordinates && state.routeCoordinates.length > 1) {
        var latlngs = state.routeCoordinates.map(function(c) { return [c.lat, c.lng]; });
        if (routeLayer) {
          map.removeLayer(routeLayer);
        }
        routeLayer = L.polyline(latlngs, {
          color: '#16A34A',
          weight: 5,
          opacity: 0.92,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);

        // Fit camera to full route with comfortable padding
        try {
          map.fitBounds(routeLayer.getBounds(), { padding: [36, 36], maxZoom: 16 });
        } catch(e) {}
      } else if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
      }
    }

    // Initial render
    updateMapState(${JSON.stringify({
      userLocation,
      pickupLocation,
      destinationLocation,
      driverLocation,
      routeCoordinates,
    })});

    // Message receiver for Web (window) and React Native (document)
    function handleIncomingMessage(event) {
      try {
        var dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        var msg = JSON.parse(dataStr);

        if (msg.action === 'centerUser' && msg.lat && msg.lng) {
          map.flyTo([msg.lat, msg.lng], 15, { animate: true, duration: 0.8 });
        } else if (msg.action === 'updateState') {
          updateMapState(msg.state);
        } else if (msg.action === 'zoomIn') {
          map.zoomIn();
        } else if (msg.action === 'zoomOut') {
          map.zoomOut();
        } else if (msg.action === 'resetPeshawar') {
          map.flyTo([${PESHAWAR_CENTER.lat}, ${PESHAWAR_CENTER.lng}], ${PESHAWAR_MAP_CONFIG.defaultZoom}, { animate: true, duration: 0.8 });
        }
      } catch(e) {}
    }

    window.addEventListener('message', handleIncomingMessage);
    document.addEventListener('message', handleIncomingMessage);
  </script>
</body>
</html>
  `;

  // Sync state changes with the running map canvas
  useEffect(() => {
    postMessageToMap({
      action: 'updateState',
      state: {
        userLocation,
        pickupLocation,
        destinationLocation,
        driverLocation,
        routeCoordinates,
      },
    });
  }, [userLocation, pickupLocation, destinationLocation, driverLocation, routeCoordinates, postMessageToMap]);

  // Recenter button action
  const handleCenterUser = () => {
    if (userLocation && isWithinPeshawar(userLocation.lat, userLocation.lng)) {
      postMessageToMap({
        action: 'centerUser',
        lat: userLocation.lat,
        lng: userLocation.lng,
      });
    } else {
      // If user location is outside Peshawar or not available, center on Peshawar city center
      postMessageToMap({ action: 'resetPeshawar' });
    }
    onCenterUser?.();
  };

  const handleZoomIn = () => {
    postMessageToMap({ action: 'zoomIn' });
  };

  const handleZoomOut = () => {
    postMessageToMap({ action: 'zoomOut' });
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Real Interactive Map Canvas */}
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          srcDoc={mapHtml}
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          onLoad={() => onMapReady?.()}
          title="SafarGo Peshawar Map"
        />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadEnd={() => onMapReady?.()}
        />
      )}

      {/* Floating Map Controls */}
      <View style={styles.floatingControls}>
        {/* Recenter Button */}
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleCenterUser}
          activeOpacity={0.8}
          accessibilityLabel="Recenter to My Location in Peshawar"
        >
          <View style={styles.recenterOuter}>
            <View style={styles.recenterDot} />
          </View>
        </TouchableOpacity>

        {/* Zoom Controls */}
        <View style={styles.zoomGroup}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={handleZoomIn}
            activeOpacity={0.7}
            accessibilityLabel="Zoom In"
          >
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={handleZoomOut}
            activeOpacity={0.7}
            accessibilityLabel="Zoom Out"
          >
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Peshawar Operating Area Badge */}
      <View style={styles.peshawarBadge}>
        <View style={styles.liveGreenDot} />
        <Text style={styles.peshawarBadgeText}>Peshawar Service Area</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
      },
    }),
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  floatingControls: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  recenterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 3px 10px rgba(0,0,0,0.14)',
      },
    }),
  },
  recenterOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  zoomGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    width: 38,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  zoomBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 22,
  },
  zoomDivider: {
    width: '75%',
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  peshawarBadge: {
    position: 'absolute',
    top: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      },
    }),
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  peshawarBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
});

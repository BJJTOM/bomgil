"""
Trail → GPX 1.1 export.

Converts a trail's path_data (GeoJSON LineString with [lng, lat, ele?]
coordinates) into a GPX 1.1 XML file suitable for import into Garmin,
Strava, AllTrails, or any standard GPS app.

The endpoint is public (no auth required) but restricted to approved,
non-hidden trails.
"""
from datetime import datetime, timezone
from xml.etree.ElementTree import Element, SubElement, tostring

from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .models import Trail

GPX_NS = "http://www.topografix.com/GPX/1/1"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
GPX_SCHEMA = "http://www.topografix.com/GPX/1/1/GPX/1/1/gpx.xsd"


def _build_gpx_xml(trail: Trail) -> bytes:
    """Build a GPX 1.1 XML document from a Trail instance."""
    gpx = Element("gpx", {
        "xmlns": GPX_NS,
        "xmlns:xsi": XSI_NS,
        "xsi:schemaLocation": f"{GPX_NS} {GPX_SCHEMA}",
        "version": "1.1",
        "creator": "Moru Walk - moruwalk.com",
    })

    # Metadata
    metadata = SubElement(gpx, "metadata")
    name_el = SubElement(metadata, "name")
    name_el.text = trail.title
    desc_el = SubElement(metadata, "desc")
    desc_el.text = trail.description
    time_el = SubElement(metadata, "time")
    time_el.text = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Track
    trk = SubElement(gpx, "trk")
    trk_name = SubElement(trk, "name")
    trk_name.text = trail.title
    if trail.description:
        trk_desc = SubElement(trk, "desc")
        trk_desc.text = trail.description

    trkseg = SubElement(trk, "trkseg")

    # Extract coordinates from GeoJSON LineString path_data.
    # Expected format: {"type": "LineString", "coordinates": [[lng, lat], [lng, lat, ele], ...]}
    # Also handle legacy format: {"points": [{"lat": ..., "lng": ..., "ele": ...}, ...]}
    path_data = trail.path_data or {}
    coordinates = path_data.get("coordinates", [])

    if not coordinates and "points" in path_data:
        # Legacy format from GPX import
        for pt in path_data["points"]:
            coord = [pt.get("lng", 0), pt.get("lat", 0)]
            if pt.get("ele") is not None:
                coord.append(pt["ele"])
            coordinates.append(coord)

    for coord in coordinates:
        if len(coord) < 2:
            continue
        # GeoJSON is [lng, lat, ele?]
        lng, lat = coord[0], coord[1]
        ele = coord[2] if len(coord) > 2 else None

        trkpt = SubElement(trkseg, "trkpt", {
            "lat": f"{lat:.6f}",
            "lon": f"{lng:.6f}",
        })
        if ele is not None:
            ele_el = SubElement(trkpt, "ele")
            ele_el.text = f"{ele:.1f}"

    xml_declaration = b'<?xml version="1.0" encoding="UTF-8"?>\n'
    return xml_declaration + tostring(gpx, encoding="unicode").encode("utf-8")


class GpxExportView(APIView):
    """GET /trails/{id}/gpx/ — download trail as GPX 1.1 file.

    Public endpoint: no authentication required, but only approved
    and non-hidden trails are accessible.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            trail = Trail.objects.get(
                pk=pk, status="approved", is_hidden=False,
            )
        except Trail.DoesNotExist:
            return HttpResponse(
                '{"detail": "코스를 찾을 수 없습니다."}',
                content_type="application/json",
                status=status.HTTP_404_NOT_FOUND,
            )

        gpx_bytes = _build_gpx_xml(trail)

        # Sanitize filename: keep alphanumeric, Korean chars, hyphens, underscores
        safe_title = "".join(
            c if c.isalnum() or c in ("-", "_", " ") or ("\uac00" <= c <= "\ud7a3") else "_"
            for c in trail.title
        ).strip() or f"trail-{trail.pk}"

        response = HttpResponse(gpx_bytes, content_type="application/gpx+xml")
        response["Content-Disposition"] = f'attachment; filename="{safe_title}.gpx"'
        return response

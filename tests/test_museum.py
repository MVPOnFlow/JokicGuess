"""Unit tests for Museum API routes (default Jokic museum + showcase museum)."""

import json
import pytest
from unittest.mock import patch, Mock, MagicMock
from flask import Flask
from routes.api import register_routes


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def app():
    test_app = Flask(__name__)
    register_routes(test_app)
    test_app.config["TESTING"] = True
    return test_app


@pytest.fixture
def client(app):
    return app.test_client()


# ── Sample data factories ────────────────────────────────────────────

def _make_binder_moment(moment_id="aaa-111", player="Nikola Jokić",
                        tier="MOMENT_TIER_LEGENDARY", set_name="Holo Icon",
                        asset_prefix="https://assets.nbatopshot.com/editions/test/",
                        serial="22", play_id="play-1", play_category="Assist",
                        date="2025-02-01T00:00:00Z", team="Denver Nuggets",
                        season="2024-25", jersey="15",
                        short_desc="Jokic sees all.", description="A long desc.",
                        circ_count=50, for_sale=4, burned=1, locked=28,
                        play_tags=None, set_play_tags=None):
    """Build a moment dict as it appears in __NEXT_DATA__ binder pages."""
    set_play = {
        "flowRetired": True,
        "circulations": {
            "circulationCount": circ_count,
            "forSaleByCollectors": for_sale,
            "burned": burned,
            "locked": locked,
        },
    }
    if set_play_tags is not None:
        set_play["tags"] = set_play_tags
    play = {
        "id": play_id,
        "shortDescription": short_desc,
        "description": description,
        "stats": {
            "playerName": player,
            "playCategory": play_category,
            "dateOfMoment": date,
            "teamAtMoment": team,
            "nbaSeason": season,
            "jerseyNumber": jersey,
        },
    }
    if play_tags is not None:
        play["tags"] = play_tags
    return {
        "id": moment_id,
        "tier": tier,
        "assetPathPrefix": asset_prefix,
        "flowSerialNumber": serial,
        "parallelID": 0,
        "set": {"flowName": set_name, "flowSeriesNumber": 7, "setVisualId": "SET_VISUAL_LEGENDARY"},
        "setPlay": set_play,
        "parallelSetPlay": None,
        "play": play,
    }


def _make_rich_moment(moment_id="aaa-111", player="Nikola Jokić",
                      tier="MOMENT_TIER_LEGENDARY", set_name="Holo Icon",
                      points=28, rebounds=9, assists=13, steals=2, blocks=0,
                      low_ask=454, highest_offer=261, serial="22",
                      description="A long description of the moment.",
                      short_desc="Jokic sees all.",
                      play_tags=None, set_play_tags=None):
    """Build a moment dict as it appears in a moment page's __NEXT_DATA__."""
    set_play = {
        "flowRetired": True,
        "circulations": {
            "circulationCount": 50,
            "forSaleByCollectors": 4,
            "burned": 1,
            "locked": 28,
        },
    }
    if set_play_tags is not None:
        set_play["tags"] = set_play_tags
    play = {
        "id": "play-1",
        "shortDescription": short_desc,
        "description": description,
        "keyStats": ["PTS", "REB", "AST"],
        "stats": {
            "playerName": player,
            "playCategory": "Assist",
            "dateOfMoment": "2025-02-01T00:00:00Z",
            "teamAtMoment": "Denver Nuggets",
            "nbaSeason": "2024-25",
            "jerseyNumber": "15",
            "homeTeamName": "Philadelphia 76ers",
            "homeTeamScore": 134,
            "awayTeamName": "Denver Nuggets",
            "awayTeamScore": 137,
        },
        "statsPlayerGameScores": {
            "points": points,
            "rebounds": rebounds,
            "assists": assists,
            "steals": steals,
            "blocks": blocks,
            "minutes": "37:28",
            "fieldGoalsMade": 11,
            "fieldGoalsAttempted": 16,
            "threePointsMade": 2,
            "threePointsAttempted": 3,
            "freeThrowsMade": 4,
            "freeThrowsAttempted": 5,
        },
        "statsPlayerSeasonAverageScores": {
            "points": 29.8,
            "rebounds": 12.5,
            "assists": 10.2,
            "steals": 1.8,
            "blocks": 0.7,
        },
    }
    if play_tags is not None:
        play["tags"] = play_tags
    return {
        "id": moment_id,
        "tier": tier,
        "assetPathPrefix": "https://assets.nbatopshot.com/editions/test/",
        "flowSerialNumber": serial,
        "parallelID": 0,
        "forSale": False,
        "price": "718.00000000",
        "lowAsk": low_ask,
        "highestOffer": highest_offer,
        "lastPurchasePrice": "626.00000000",
        "set": {"flowName": set_name, "flowSeriesNumber": 7, "setVisualId": "SET_VISUAL_LEGENDARY"},
        "setPlay": set_play,
        "parallelSetPlay": None,
        "play": play,
        "topshotScore": {"score": 6260, "averageSalePrice": "584.10000000"},
        "owner": {"username": "bobobobo", "flowAddress": "334a20bbaa7f2801"},
        "edition": {
            "marketplaceInfo": {
                "priceRange": {"min": "454.00000000"},
                "averageSaleData": {"averagePrice": "584.10"},
            },
        },
    }


def _make_showcase_html(binder_name="Jokic fav", moments=None):
    """Build fake HTML with embedded __NEXT_DATA__ JSON."""
    if moments is None:
        moments = [_make_binder_moment()]
    binder = {
        "name": binder_name,
        "pages": [{"moments": moments}],
    }
    next_data = json.dumps({"props": {"pageProps": {"binder": binder}}})
    return (
        '<html><head></head><body>'
        f'<script id="__NEXT_DATA__" type="application/json">{next_data}</script>'
        '</body></html>'
    )


def _make_graphql_response(moment_dict):
    """Build a fake getMintedMoment GraphQL JSON response."""
    return {"data": {"getMintedMoment": {"data": moment_dict}}}


def _mock_post_graphql(moment_map):
    """Return a side_effect for http_requests.post that serves GraphQL responses.

    moment_map: dict of moment_id → moment_dict (from _make_rich_moment).
    Moments not in the map get None → light fallback.
    """
    def side_effect(url, json=None, **kwargs):
        resp = Mock()
        resp.status_code = 200
        resp.raise_for_status = Mock()
        mid = (json or {}).get("variables", {}).get("momentId", "")
        resp.json = Mock(return_value=_make_graphql_response(moment_map.get(mid)))
        return resp
    return side_effect


# ═══════════════════════════════════════════════════════════════════════
#  DEFAULT JOKIĆ MUSEUM  (/api/museum)
# ═══════════════════════════════════════════════════════════════════════

class TestDefaultMuseum:
    """Tests for /api/museum endpoint (default Jokic museum)."""

    @patch("routes.api.get_jokic_editions")
    def test_returns_editions(self, mock_get, client):
        """Basic success – returns editions from get_jokic_editions."""
        mock_get.return_value = {"editions": [{"id": "1", "tier": "COMMON"}]}
        resp = client.get("/api/museum")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "editions" in data
        assert len(data["editions"]) == 1

    @patch("routes.api.get_jokic_editions")
    def test_empty_editions(self, mock_get, client):
        """Returns empty list when no editions found."""
        mock_get.return_value = {"editions": []}
        resp = client.get("/api/museum")
        assert resp.status_code == 200
        assert resp.get_json()["editions"] == []

    @patch("routes.api.get_dapper_id_from_flow_wallet")
    @patch("routes.api.get_jokic_editions")
    def test_with_wallet_param(self, mock_get, mock_dapper, client):
        """Passes dapper ID when wallet query param is provided."""
        mock_dapper.return_value = "dapper-123"
        mock_get.return_value = {"editions": [{"id": "1", "userOwnedCount": 2}]}
        resp = client.get("/api/museum?wallet=0xabc123")
        assert resp.status_code == 200
        mock_dapper.assert_called_once_with("0xabc123")
        mock_get.assert_called_once_with(dapper_id="dapper-123")

    @patch("routes.api.get_jokic_editions")
    def test_without_wallet_param(self, mock_get, client):
        """Calls get_jokic_editions with empty dapper_id when no wallet."""
        mock_get.return_value = {"editions": []}
        client.get("/api/museum")
        mock_get.assert_called_once_with(dapper_id="")

    @patch("routes.api.get_jokic_editions")
    def test_error_returns_500(self, mock_get, client):
        """Returns 500 when get_jokic_editions raises."""
        mock_get.side_effect = RuntimeError("TopShot API down")
        resp = client.get("/api/museum")
        assert resp.status_code == 500
        data = resp.get_json()
        assert "error" in data
        assert "TopShot API down" in data["error"]


# ═══════════════════════════════════════════════════════════════════════
#  SHOWCASE MUSEUM  (/api/showcase/<binder_id>)
# ═══════════════════════════════════════════════════════════════════════

class TestShowcaseMuseumValidation:
    """Input validation for /api/showcase/<binder_id>."""

    def test_invalid_id_too_short(self, client):
        resp = client.get("/api/showcase/not-a-uuid")
        assert resp.status_code == 400
        assert "Invalid" in resp.get_json()["error"]

    def test_invalid_id_special_chars(self, client):
        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156!")
        assert resp.status_code == 400

    def test_valid_uuid_format_accepted(self, client):
        """A valid UUID should not be rejected by validation (may fail on fetch)."""
        with patch("routes.api.http_requests.get") as mock_get:
            mock_get.side_effect = Exception("network")
            resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
            # Should get past validation – either 502 or 500, not 400
            assert resp.status_code in [500, 502]


class TestShowcaseMuseumScraping:
    """Tests for showcase page scraping and __NEXT_DATA__ parsing."""

    @patch("routes.api.http_requests.get")
    def test_showcase_not_found_returns_404(self, mock_get, client):
        """When binder is missing from pageProps, return 404."""
        next_data = json.dumps({"props": {"pageProps": {}}})
        html = f'<script id="__NEXT_DATA__" type="application/json">{next_data}</script>'
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        assert resp.status_code == 404
        assert "not found" in resp.get_json()["error"].lower()

    @patch("routes.api.http_requests.get")
    def test_no_next_data_returns_502(self, mock_get, client):
        """When page has no __NEXT_DATA__, return 502."""
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body>No data here</body></html>"
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        assert resp.status_code == 502
        assert "parse" in resp.get_json()["error"].lower()

    @patch("routes.api.http_requests.get")
    def test_network_error_returns_502(self, mock_get, client):
        """Network/HTTP errors return 502."""
        import requests as real_requests
        mock_get.side_effect = real_requests.ConnectionError("timeout")

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        assert resp.status_code == 502
        assert "Failed to fetch" in resp.get_json()["error"]

    @patch("routes.api.http_requests.get")
    def test_http_403_returns_502(self, mock_get, client):
        """403 from TopShot should surface as 502."""
        import requests as real_requests
        mock_resp = Mock()
        mock_resp.status_code = 403
        mock_resp.raise_for_status.side_effect = real_requests.HTTPError(response=mock_resp)
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        assert resp.status_code == 502


class TestShowcaseMuseumSuccess:
    """Happy-path tests for showcase enrichment flow."""

    @staticmethod
    def _mock_showcase_get(showcase_html):
        """Build a side_effect for http_requests.get that serves showcase pages."""
        def side_effect(url, **kwargs):
            resp = Mock()
            resp.status_code = 200
            resp.raise_for_status = Mock()
            resp.text = showcase_html
            return resp
        return side_effect

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_single_moment_enriched(self, mock_get, mock_post, client):
        """One moment in showcase – enriched with game stats."""
        moment_id = "aaa-111"
        showcase_html = _make_showcase_html("Test Showcase", [_make_binder_moment(moment_id=moment_id)])
        rich = _make_rich_moment(moment_id=moment_id, points=28, rebounds=9, assists=13)

        mock_get.side_effect = self._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["showcaseName"] == "Test Showcase"
        assert len(data["editions"]) == 1

        ed = data["editions"][0]
        assert ed["id"] == moment_id
        assert ed["tier"] == "LEGENDARY"
        assert ed["playerName"] == "Nikola Jokić"
        assert ed["gameStats"]["points"] == 28
        assert ed["gameStats"]["rebounds"] == 9
        assert ed["gameStats"]["assists"] == 13
        assert ed["description"] == "A long description of the moment."
        assert ed["lowAsk"] == 454
        assert ed["ownerUsername"] == "bobobobo"

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_multiple_moments(self, mock_get, mock_post, client):
        """Multiple moments in showcase – all enriched."""
        moments = [
            _make_binder_moment(moment_id="m1", player="Nikola Joki\u0107", set_name="Holo Icon"),
            _make_binder_moment(moment_id="m2", player="Nikola Joki\u0107", set_name="2023 NBA Finals"),
        ]
        showcase_html = _make_showcase_html("Multi Showcase", moments)
        mock_get.side_effect = self._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({
            "m1": _make_rich_moment(moment_id="m1", points=28),
            "m2": _make_rich_moment(moment_id="m2", points=53, rebounds=4, assists=11),
        })

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        data = resp.get_json()
        assert len(data["editions"]) == 2
        assert data["editions"][0]["gameStats"]["points"] == 28
        assert data["editions"][1]["gameStats"]["points"] == 53

    @patch("routes.api.http_requests.post", side_effect=Exception("no graphql"))
    @patch("routes.api.http_requests.get")
    def test_fallback_when_moment_page_fails(self, mock_get, mock_post, client):
        """When GraphQL enrichment fails, fall back to light edition (no gameStats)."""
        moment_id = "aaa-111"
        showcase_html = _make_showcase_html("Fallback Test", [_make_binder_moment(moment_id=moment_id)])

        mock_get.side_effect = self._mock_showcase_get(showcase_html)

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        data = resp.get_json()
        assert len(data["editions"]) == 1
        ed = data["editions"][0]
        # Light edition – still has basic info from binder
        assert ed["playerName"] == "Nikola Jokić"
        assert ed["tier"] == "LEGENDARY"
        assert ed["setName"] == "Holo Icon"
        # But no game stats
        assert ed["gameStats"] is None

    @patch("routes.api.http_requests.get")
    def test_empty_showcase(self, mock_get, client):
        """Showcase with no moments returns empty editions."""
        showcase_html = _make_showcase_html("Empty", [])
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.text = showcase_html
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        data = resp.get_json()
        assert data["editions"] == []
        assert data["showcaseName"] == "Empty"

    @patch("routes.api.http_requests.post", side_effect=Exception("no graphql"))
    @patch("routes.api.http_requests.get")
    def test_showcase_preserves_order(self, mock_get, mock_post, client):
        """Editions are returned in the same order as the showcase pages."""
        moments = [
            _make_binder_moment(moment_id=f"m{i}", set_name=f"Set {i}")
            for i in range(5)
        ]
        showcase_html = _make_showcase_html("Ordered", moments)
        mock_get.side_effect = self._mock_showcase_get(showcase_html)

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        data = resp.get_json()
        ids = [e["id"] for e in data["editions"]]
        assert ids == ["m0", "m1", "m2", "m3", "m4"]


# ═══════════════════════════════════════════════════════════════════════
#  EDITION TRANSFORM HELPERS
# ═══════════════════════════════════════════════════════════════════════

class TestMomentToEdition:
    """Tests for _moment_to_edition (rich) transformation."""

    def _get_transform(self, app):
        """Access the closure-scoped _moment_to_edition via the app's route context."""
        # We need to call register_routes to get the helpers defined; they're closures
        # inside register_routes. We test them indirectly through the route, but also
        # test edge cases on the transform logic via the showcase route.
        pass

    @patch("routes.api.http_requests.post", side_effect=Exception("no graphql"))
    @patch("routes.api.http_requests.get")
    def test_tier_prefix_stripped(self, mock_get, mock_post, client):
        """MOMENT_TIER_LEGENDARY → LEGENDARY, etc."""
        for raw, expected in [
            ("MOMENT_TIER_LEGENDARY", "LEGENDARY"),
            ("MOMENT_TIER_RARE", "RARE"),
            ("MOMENT_TIER_COMMON", "COMMON"),
        ]:
            m = _make_binder_moment(moment_id="t1", tier=raw)
            showcase_html = _make_showcase_html("Tier Test", [m])
            # No moment page → light fallback
            mock_resp = Mock()
            mock_resp.status_code = 200
            mock_resp.text = showcase_html
            mock_resp.raise_for_status = Mock()
            mock_get.return_value = mock_resp

            resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
            assert resp.get_json()["editions"][0]["tier"] == expected

    @patch("routes.api.http_requests.post", side_effect=Exception("no graphql"))
    @patch("routes.api.http_requests.get")
    def test_asset_urls_constructed(self, mock_get, mock_post, client):
        """Image and video URLs are built from assetPathPrefix."""
        prefix = "https://assets.nbatopshot.com/editions/test/"
        m = _make_binder_moment(moment_id="t1", asset_prefix=prefix)
        showcase_html = _make_showcase_html("Asset Test", [m])
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.text = showcase_html
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        ed = resp.get_json()["editions"][0]
        assert ed["imageUrl"] == f"{prefix}Hero_2880_2880_Black.jpg"
        assert ed["videoUrl"] == f"{prefix}Animated_1080_1080_Black.mp4"

    @patch("routes.api.http_requests.post", side_effect=Exception("no graphql"))
    @patch("routes.api.http_requests.get")
    def test_empty_asset_prefix(self, mock_get, mock_post, client):
        """No assetPathPrefix → empty image/video URLs."""
        m = _make_binder_moment(moment_id="t1", asset_prefix="")
        showcase_html = _make_showcase_html("No Asset", [m])
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.text = showcase_html
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        ed = resp.get_json()["editions"][0]
        assert ed["imageUrl"] == ""
        assert ed["videoUrl"] == ""

    @patch("routes.api.http_requests.post", side_effect=Exception("no graphql"))
    @patch("routes.api.http_requests.get")
    def test_circulations_from_parallelSetPlay_fallback(self, mock_get, mock_post, client):
        """Uses parallelSetPlay circulations when setPlay.circulations is missing."""
        m = _make_binder_moment(moment_id="t1")
        m["setPlay"]["circulations"] = None
        m["parallelSetPlay"] = {
            "circulations": {
                "circulationCount": 99,
                "forSaleByCollectors": 10,
                "burned": 5,
                "locked": 20,
            }
        }
        showcase_html = _make_showcase_html("Parallel Test", [m])
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.text = showcase_html
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        ed = resp.get_json()["editions"][0]
        assert ed["circulationCount"] == 99
        assert ed["burned"] == 5

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_rich_edition_game_stats_fields(self, mock_get, mock_post, client):
        """Enriched edition includes full game stats with shooting splits."""
        moment_id = "gs-1"
        rich = _make_rich_moment(moment_id=moment_id, points=28, rebounds=9, assists=13, steals=2, blocks=0)
        showcase_html = _make_showcase_html("Stats", [_make_binder_moment(moment_id=moment_id)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        gs = resp.get_json()["editions"][0]["gameStats"]
        assert gs["points"] == 28
        assert gs["rebounds"] == 9
        assert gs["assists"] == 13
        assert gs["steals"] == 2
        assert gs["blocks"] == 0
        assert gs["minutes"] == "37:28"
        assert gs["fieldGoalsMade"] == 11
        assert gs["fieldGoalsAttempted"] == 16
        assert gs["threePointsMade"] == 2
        assert gs["freeThrowsMade"] == 4

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_rich_edition_season_averages(self, mock_get, mock_post, client):
        """Enriched edition includes season averages."""
        moment_id = "sa-1"
        rich = _make_rich_moment(moment_id=moment_id)
        showcase_html = _make_showcase_html("SeasonAvg", [_make_binder_moment(moment_id=moment_id)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        sa = resp.get_json()["editions"][0]["seasonAverages"]
        assert sa is not None
        assert sa["points"] == 29.8
        assert sa["rebounds"] == 12.5
        assert sa["assists"] == 10.2

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_rich_edition_marketplace_fields(self, mock_get, mock_post, client):
        """Enriched edition includes lowAsk, topshotScore, floorPrice, etc."""
        moment_id = "mkt-1"
        rich = _make_rich_moment(moment_id=moment_id, low_ask=454, highest_offer=261)
        showcase_html = _make_showcase_html("Market", [_make_binder_moment(moment_id=moment_id)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        ed = resp.get_json()["editions"][0]
        assert ed["lowAsk"] == 454
        assert ed["highestOffer"] == 261
        assert ed["topshotScore"] == 6260
        assert ed["floorPrice"] == "454.00000000"
        assert ed["flowSerialNumber"] == "22"

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_rich_edition_game_context(self, mock_get, mock_post, client):
        """Enriched edition includes home/away team names and scores."""
        moment_id = "ctx-1"
        rich = _make_rich_moment(moment_id=moment_id)
        showcase_html = _make_showcase_html("Context", [_make_binder_moment(moment_id=moment_id)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        ed = resp.get_json()["editions"][0]
        assert ed["homeTeamName"] == "Philadelphia 76ers"
        assert ed["homeTeamScore"] == 134
        assert ed["awayTeamName"] == "Denver Nuggets"
        assert ed["awayTeamScore"] == 137


class TestShowcaseMultiplePages:
    """Test showcases spanning multiple binder pages."""

    @patch("routes.api.http_requests.get")
    def test_moments_from_multiple_pages(self, mock_get, client):
        """Moments from multiple binder pages are all collected."""
        binder = {
            "name": "Multi-Page",
            "pages": [
                {"moments": [_make_binder_moment(moment_id="p1-m1")]},
                {"moments": [_make_binder_moment(moment_id="p2-m1"), _make_binder_moment(moment_id="p2-m2")]},
            ],
        }
        next_data = json.dumps({"props": {"pageProps": {"binder": binder}}})
        html = f'<script id="__NEXT_DATA__" type="application/json">{next_data}</script>'

        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        data = resp.get_json()
        assert len(data["editions"]) == 3
        ids = [e["id"] for e in data["editions"]]
        assert ids == ["p1-m1", "p2-m1", "p2-m2"]


class TestMixedEnrichment:
    """Test partial enrichment – some moments enrich, others fall back."""

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_partial_enrichment(self, mock_get, mock_post, client):
        """When some moment pages work and others don't, mix rich + light editions."""
        moments = [
            _make_binder_moment(moment_id="ok-1"),
            _make_binder_moment(moment_id="fail-1"),
        ]
        showcase_html = _make_showcase_html("Mixed", moments)
        rich = _make_rich_moment(moment_id="ok-1", points=32, rebounds=21, assists=10)

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        # Only "ok-1" in map → "fail-1" gets None → light fallback
        mock_post.side_effect = _mock_post_graphql({"ok-1": rich})

        resp = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a")
        data = resp.get_json()
        assert len(data["editions"]) == 2

        # First moment: enriched with game stats
        assert data["editions"][0]["gameStats"] is not None
        assert data["editions"][0]["gameStats"]["points"] == 32

        # Second moment: light fallback, no game stats
        assert data["editions"][1]["gameStats"] is None
        # But still has basic info
        assert data["editions"][1]["playerName"] == "Nikola Jokić"
        assert data["editions"][1]["tier"] == "LEGENDARY"


class TestBadgeTags:
    """Verify badge tag extraction from play.tags and setPlay.tags."""

    def _tag(self, title, visible=True, level="PLAY"):
        return {"id": "uuid-" + title, "title": title, "visible": visible,
                "level": level, "__typename": "Tag"}

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_mvp_and_championship_from_play_tags(self, mock_get, mock_post, client):
        """Tags on play level are extracted as camelCase slugs."""
        moment_id = "badge-1"
        play_tags = [self._tag("MVP Year"), self._tag("Championship Year")]
        rich = _make_rich_moment(moment_id=moment_id, play_tags=play_tags)
        showcase_html = _make_showcase_html("Badge Test",
                                            [_make_binder_moment(moment_id=moment_id, play_tags=play_tags)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})
        data = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a").get_json()
        assert "mvpYear" in data["editions"][0]["tags"]
        assert "championshipYear" in data["editions"][0]["tags"]

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_rookie_mint_from_setplay_tags(self, mock_get, mock_post, client):
        """Tags on setPlay level are also captured."""
        moment_id = "badge-2"
        sp_tags = [self._tag("Rookie Mint", level="SETPLAY")]
        rich = _make_rich_moment(moment_id=moment_id, set_play_tags=sp_tags)
        showcase_html = _make_showcase_html("SP Badge",
                                            [_make_binder_moment(moment_id=moment_id, set_play_tags=sp_tags)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})
        data = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a").get_json()
        assert "rookieMint" in data["editions"][0]["tags"]

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_invisible_tags_excluded(self, mock_get, mock_post, client):
        """Tags with visible=false should not appear."""
        moment_id = "badge-3"
        play_tags = [self._tag("MVP Year"), self._tag("NBA Finals", visible=False)]
        rich = _make_rich_moment(moment_id=moment_id, play_tags=play_tags)
        showcase_html = _make_showcase_html("Vis",
                                            [_make_binder_moment(moment_id=moment_id, play_tags=play_tags)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})
        data = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a").get_json()
        assert "mvpYear" in data["editions"][0]["tags"]
        # NBA Finals has no camelCase mapping and is invisible -> not in output
        assert len(data["editions"][0]["tags"]) == 1

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_no_tags_returns_empty_list(self, mock_get, mock_post, client):
        """Moments without tags get empty list."""
        moment_id = "badge-4"
        rich = _make_rich_moment(moment_id=moment_id)
        showcase_html = _make_showcase_html("No Tags", [_make_binder_moment(moment_id=moment_id)])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})
        data = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a").get_json()
        assert data["editions"][0]["tags"] == []

    @patch("routes.api.http_requests.post")
    @patch("routes.api.http_requests.get")
    def test_dedup_same_tag_both_levels(self, mock_get, mock_post, client):
        """Same tag on play and setPlay is deduplicated."""
        moment_id = "badge-5"
        tag = self._tag("Rookie Year")
        rich = _make_rich_moment(moment_id=moment_id, play_tags=[tag],
                                 set_play_tags=[self._tag("Rookie Year", level="SETPLAY")])
        showcase_html = _make_showcase_html("Dup",
                                            [_make_binder_moment(moment_id=moment_id, play_tags=[tag])])

        mock_get.side_effect = TestShowcaseMuseumSuccess._mock_showcase_get(showcase_html)
        mock_post.side_effect = _mock_post_graphql({moment_id: rich})
        data = client.get("/api/showcase/d9d1bbca-a418-483e-aaae-61d78fe1156a").get_json()
        assert data["editions"][0]["tags"].count("rookieYear") == 1

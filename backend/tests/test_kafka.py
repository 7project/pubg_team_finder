import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from aiokafka.errors import KafkaError
import app.core.kafka as kafka_module


class TestKafkaProducer:
    """Test Kafka producer functions"""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_get_kafka_producer_creates_new(self):
        """Test that get_kafka_producer creates a new producer if none exists"""
        kafka_module._producer = None

        mock_instance = AsyncMock()
        mock_producer_class = AsyncMock(return_value=mock_instance)

        with patch("app.core.kafka.AIOKafkaProducer", mock_producer_class):
            from app.core.kafka import get_kafka_producer
            result = await get_kafka_producer()

            mock_producer_class.assert_called_once()
            mock_instance.start.assert_called_once()
            assert result == mock_instance

        kafka_module._producer = None

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_get_kafka_producer_returns_existing(self):
        """Test that get_kafka_producer returns existing producer"""
        mock_instance = AsyncMock()
        kafka_module._producer = mock_instance

        from app.core.kafka import get_kafka_producer

        result = await get_kafka_producer()

        assert result == mock_instance

        kafka_module._producer = None

    @pytest.mark.asyncio
    async def test_stop_kafka_producer(self):
        """Test stopping Kafka producer"""
        mock_instance = AsyncMock()
        kafka_module._producer = mock_instance

        from app.core.kafka import stop_kafka_producer

        await stop_kafka_producer()

        mock_instance.stop.assert_called_once()
        assert kafka_module._producer is None


class TestSendMatchInvite:
    """Test send_match_invite function"""

    @patch("app.core.kafka.get_kafka_producer")
    async def test_send_match_invite_success(self, mock_get_producer):
        """Test successful match invite sending"""
        from app.core.kafka import send_match_invite

        mock_producer = AsyncMock()
        mock_get_producer.return_value = mock_producer

        result = await send_match_invite("match1", "user1", "creator1", "invited1")

        assert result == True
        mock_producer.send_and_wait.assert_called_once()
        call_args = mock_producer.send_and_wait.call_args
        assert call_args[0][0] == "match_invites"

        message = call_args[0][1]
        assert message["event_type"] == "match_invite_sent"
        assert message["match_id"] == "match1"
        assert message["user_id"] == "user1"

    @patch("app.core.kafka.get_kafka_producer")
    async def test_send_match_invite_kafka_error(self, mock_get_producer):
        """Test handling Kafka error when sending invite"""
        from app.core.kafka import send_match_invite

        mock_producer = AsyncMock()
        mock_producer.send_and_wait.side_effect = KafkaError("Kafka error")
        mock_get_producer.return_value = mock_producer

        result = await send_match_invite("match1", "user1", "creator1", "invited1")

        assert result == False


class TestSendMatchEvent:
    """Test send_match_event function"""

    @patch("app.core.kafka.get_kafka_producer")
    async def test_send_match_event_success(self, mock_get_producer):
        """Test successful match event sending"""
        from app.core.kafka import send_match_event

        mock_producer = AsyncMock()
        mock_get_producer.return_value = mock_producer

        result = await send_match_event("match_created", "match1", "user1", match_type="SQUAD")

        assert result == True
        mock_producer.send_and_wait.assert_called_once()
        call_args = mock_producer.send_and_wait.call_args
        assert call_args[0][0] == "match_events"

        message = call_args[0][1]
        assert message["event_type"] == "match_created"
        assert message["match_id"] == "match1"
        assert message["match_type"] == "SQUAD"

    @patch("app.core.kafka.get_kafka_producer")
    async def test_send_match_created(self, mock_get_producer):
        """Test send_match_created convenience function"""
        from app.core.kafka import send_match_created

        mock_producer = AsyncMock()
        mock_get_producer.return_value = mock_producer

        result = await send_match_created("match1", "user1", "SQUAD", 4)

        assert result == True

    @patch("app.core.kafka.get_kafka_producer")
    async def test_send_invite_accepted(self, mock_get_producer):
        """Test send_invite_accepted convenience function"""
        from app.core.kafka import send_invite_accepted

        mock_producer = AsyncMock()
        mock_get_producer.return_value = mock_producer

        result = await send_invite_accepted("match1", "user1")

        assert result == True

    @patch("app.core.kafka.get_kafka_producer")
    async def test_send_match_left(self, mock_get_producer):
        """Test send_match_left convenience function"""
        from app.core.kafka import send_match_left

        mock_producer = AsyncMock()
        mock_get_producer.return_value = mock_producer

        result = await send_match_left("match1", "user1")

        assert result == True

    @patch("app.core.kafka.get_kafka_producer")
    async def test_send_match_completed(self, mock_get_producer):
        """Test send_match_completed convenience function"""
        from app.core.kafka import send_match_completed

        mock_producer = AsyncMock()
        mock_get_producer.return_value = mock_producer

        result = await send_match_completed("match1", "user1")

        assert result == True


@pytest.mark.integration
class TestKafkaIntegrationWithMatchService:
    """Test that match_service functions send Kafka events"""

    @pytest.mark.asyncio
    async def test_send_match_created_function(self, mock_kafka):
        """Test that send_match_created can be called"""
        from app.core.kafka import send_match_created

        with patch("app.core.kafka.get_kafka_producer") as mock_get_producer:
            mock_producer = AsyncMock()
            mock_get_producer.return_value = mock_producer

            result = await send_match_created("match1", "user1", "SQUAD", 4)
            assert result == True